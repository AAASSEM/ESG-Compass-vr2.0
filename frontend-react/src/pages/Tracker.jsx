import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { esgAPI } from '../services/api';
import { progressLogger } from '../utils/progress_logging';
import { getTaskRequirements, extractDataFields, extractRequiredDocuments } from '../utils/taskFieldExtraction';

const Tracker = () => {
  const [viewMode, setViewMode] = useState('data'); // 'data' or 'evidence'
  const [version, setVersion] = useState(0); // force re-render when log updates
  const navigate = useNavigate();

  // Load real progress data from API
  const { data: company } = useQuery(
    'company',
    () => esgAPI.getCompany(),
    { retry: 1, staleTime: 5 * 60 * 1000 }
  );

  const { data: tasks } = useQuery(
    'tasks',
    () => esgAPI.getTasks(),
    { 
      retry: 1, 
      staleTime: 5 * 60 * 1000,
      select: (data) => Array.isArray(data) ? data : data?.results || []
    }
  );

  // Set current user for ProgressLogger isolation
  React.useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user && user.email) {
      progressLogger.setUser(user);
    }
  }, []);

  // Helper function to get user's actual meters from location data
  const getUserMeters = () => {
    const availableMeters = { electricity: false, water: false, gas: false };
    
    if (company?.scoping_data?.locations) {
      company.scoping_data.locations.forEach(location => {
        if (location.meters) {
          location.meters.forEach(meter => {
            if (meter.type === 'electricity') availableMeters.electricity = true;
            if (meter.type === 'water') availableMeters.water = true;
            if (meter.type === 'gas') availableMeters.gas = true;
          });
        }
      });
    }
    
    return availableMeters;
  };

  // Keep log in sync with latest DB state (enhanced sync)
  React.useEffect(() => {
    if (tasks && tasks.length > 0) {
      console.log('🔄 SYNCING ProgressLogger with database tasks...');
      const changed = progressLogger.syncWithDatabase(tasks);
      if (changed) {
        console.log('✅ ProgressLogger updated from database');
        setVersion(v => v + 1);
      } else {
        console.log('📊 ProgressLogger already in sync');
      }
    }
  }, [tasks]);



  // Override required file counts in the log based on shared utilities
  React.useEffect(() => {
    if (!tasks || tasks.length === 0) return;
    let changed = false;
    tasks.forEach(task => {
      const requirements = getTaskRequirements(task);
      const requiredCount = requirements.expectedFiles;
      const before = progressLogger.getLog().tasks?.[task.id]?.files?.required;
      progressLogger.updateRequiredFiles(task.id, requiredCount);
      const after = progressLogger.getLog().tasks?.[task.id]?.files?.required;
      if (before !== after) changed = true;
    });
    if (changed) setVersion(v => v + 1);
  }, [tasks]);

  const { data: progressData, error: progressError, isLoading: progressLoading } = useQuery(
    'progress-tracker',
    () => esgAPI.getProgressTracker(),
    { retry: 1, staleTime: 2 * 60 * 1000 }
  );

  // Debug API data loading
  console.log('🔍 TRACKER API STATUS:', {
    progressData: !!progressData,
    progressError,
    progressLoading,
    hasCompany: !!company
  });

  // Calculate progress using shared utilities - NO localStorage
  const calculateProgressFromDB = () => {
    if (!tasks || tasks.length === 0) {
      return {
        dataProgress: { overall: 0, completed: 0, total: 0, environmental: 0, social: 0, governance: 0 },
        evidenceProgress: { overall: 0, completed: 0, total: 0, environmental: 0, social: 0, governance: 0 }
      };
    }
    
    let totalFilesExpected = 0;
    let totalFilesCompleted = 0;
    let totalDataFieldsExpected = 0;
    let totalDataFieldsCompleted = 0;
    
    // Category-specific counters
    const categoryStats = {
      environmental: { filesExpected: 0, filesCompleted: 0, dataExpected: 0, dataCompleted: 0, total: 0, completed: 0 },
      social: { filesExpected: 0, filesCompleted: 0, dataExpected: 0, dataCompleted: 0, total: 0, completed: 0 },
      governance: { filesExpected: 0, filesCompleted: 0, dataExpected: 0, dataCompleted: 0, total: 0, completed: 0 }
    };

    tasks.forEach(task => {
      const category = task.category || 'general';
      
      // Use shared utility to get task requirements
      const requirements = getTaskRequirements(task);
      const expectedFiles = requirements.expectedFiles;
      const expectedDataFields = requirements.expectedDataFields;
      
      // Count task completion
      const isTaskCompleted = task.status === 'completed' || task.progress_percentage >= 100;
      
      // Count actual completions
      const actualFiles = (task.attachments || []).length;
      const actualDataEntries = task.data_entries ? 
        Object.keys(task.data_entries).filter(key => 
          task.data_entries[key] && 
          key !== 'notes' && 
          !key.includes('cost')
        ).length : 0;
      
      // Update totals
      totalFilesExpected += expectedFiles;
      totalFilesCompleted += Math.min(actualFiles, expectedFiles);
      totalDataFieldsExpected += expectedDataFields;
      totalDataFieldsCompleted += Math.min(actualDataEntries, expectedDataFields);
      
      // Update category stats
      if (categoryStats[category]) {
        categoryStats[category].filesExpected += expectedFiles;
        categoryStats[category].filesCompleted += Math.min(actualFiles, expectedFiles);
        categoryStats[category].dataExpected += expectedDataFields;
        categoryStats[category].dataCompleted += Math.min(actualDataEntries, expectedDataFields);
        categoryStats[category].total += 1;
        if (isTaskCompleted) {
          categoryStats[category].completed += 1;
        }
      }
    });
    
    // Calculate percentages
    const dataPercentage = totalDataFieldsExpected > 0 ? 
      Math.round((totalDataFieldsCompleted / totalDataFieldsExpected) * 100) : 0;
    
    const evidencePercentage = totalFilesExpected > 0 ? 
      Math.round((totalFilesCompleted / totalFilesExpected) * 100) : 0;
    
    // Calculate category percentages
    const calculateCategoryPercentage = (category, type) => {
      if (type === 'data') {
        const expected = categoryStats[category]?.dataExpected || 0;
        const completed = categoryStats[category]?.dataCompleted || 0;
        return expected > 0 ? Math.round((completed / expected) * 100) : 0;
      } else {
        const expected = categoryStats[category]?.filesExpected || 0;
        const completed = categoryStats[category]?.filesCompleted || 0;
        return expected > 0 ? Math.round((completed / expected) * 100) : 0;
      }
    };

    return {
      dataProgress: {
        overall: dataPercentage,
        completed: totalDataFieldsCompleted,
        total: totalDataFieldsExpected,
        environmental: calculateCategoryPercentage('environmental', 'data'),
        social: calculateCategoryPercentage('social', 'data'),
        governance: calculateCategoryPercentage('governance', 'data')
      },
      evidenceProgress: {
        overall: evidencePercentage,
        completed: totalFilesCompleted,
        total: totalFilesExpected,
        environmental: calculateCategoryPercentage('environmental', 'file'),
        social: calculateCategoryPercentage('social', 'file'),
        governance: calculateCategoryPercentage('governance', 'file')
      }
    };
  };

  // Read progress from centralized log (counts files and data entries) with enhanced DB sync
  const logSummary = progressLogger.getProgressSummary();
  const isLogEmpty = !logSummary?.taskSummary || logSummary.taskSummary.total === 0;
  
  // Use ProgressLogger as primary source, with DB calculation as fallback for accuracy
  const progress = !isLogEmpty ? logSummary : calculateProgressFromDB();
  
  console.log('📊 PROGRESS SOURCE:', !isLogEmpty ? 'PROGRESS LOGGER' : 'DATABASE FALLBACK');
  
  if (!isLogEmpty) {
    console.log('✅ Using ProgressLogger - Real-time tracking with localStorage');
    console.log('📊 ProgressLogger Summary:', {
      dataProgress: `${progress.dataProgress.completed}/${progress.dataProgress.total} (${progress.dataProgress.overall}%)`,
      evidenceProgress: `${progress.evidenceProgress.completed}/${progress.evidenceProgress.total} (${progress.evidenceProgress.overall}%)`,
      taskSummary: progress.taskSummary
    });
  } else {
    console.log('🔄 Using Database Fallback - Direct calculation from API data');
  }
  console.log('📊 Data vs Evidence separation from DATABASE:', {
    dataFields: `${progress.dataProgress.completed}/${progress.dataProgress.total} fields`,
    evidenceFiles: `${progress.evidenceProgress.completed}/${progress.evidenceProgress.total} files`
  });

  // Debug which progress calculation is being used
  console.log('📈 PROGRESS SOURCE:', progressData ? 'API DATA' : 'LOCALSTORAGE FALLBACK');
  if (progressData) {
    console.log('📊 API PROGRESS DATA:', {
      evidence_uploaded_percentage: progressData.evidence_uploaded_percentage,
      uploaded_evidence_files: progressData.uploaded_evidence_files,
      total_evidence_files: progressData.total_evidence_files,
      environmental_progress: progressData.environmental_progress,
      social_progress: progressData.social_progress,
      governance_progress: progressData.governance_progress
    });
  }

  // Generate dynamic metrics using shared utilities and viewMode
  const getMetricsByCategory = (category, currentViewMode) => {
    if (!tasks || tasks.length === 0) {
      return [{ name: 'No tasks available', status: 'pending', evidence: '' }];
    }

    const categoryTasks = tasks.filter(task => 
      task.category === category || task.title.toLowerCase().includes(category.toLowerCase())
    );

    if (categoryTasks.length === 0) {
      return [{ name: `No ${category} tasks`, status: 'pending', evidence: '' }];
    }

    // Show first 4 tasks with their actual progress
    return categoryTasks.slice(0, 4).map(task => {
      // Use shared utilities to determine task requirements
      const requirements = getTaskRequirements(task);
      const needsFiles = requirements.expectedFiles > 0;
      const needsData = requirements.expectedDataFields > 0;
      
      // Get actual progress
      const attachments = (task.attachments || []).length;
      const dataEntries = task.data_entries ? 
        Object.keys(task.data_entries).filter(key => 
          task.data_entries[key] && 
          key !== 'notes' && 
          !key.includes('cost')
        ).length : 0;
      
      let status = 'pending';
      let evidenceCount = '';
      
      if (task.status === 'completed' || task.progress_percentage >= 100) {
        status = 'complete';
        
        // Show completion based on view mode
        if (currentViewMode === 'data') {
          if (needsData) {
            evidenceCount = `${dataEntries}/${requirements.expectedDataFields} data`;
          } else {
            evidenceCount = 'No data needed';
          }
        } else { // evidence mode
          if (needsFiles) {
            evidenceCount = `${attachments}/${requirements.expectedFiles} files`;
          } else {
            evidenceCount = 'No files needed';
          }
        }
      } else {
        // In progress or pending - show current progress vs required
        if (currentViewMode === 'data') {
          if (needsData) {
            evidenceCount = `${dataEntries}/${requirements.expectedDataFields} data`;
            // Complete if we have all required data entries
            if (dataEntries >= requirements.expectedDataFields) {
              status = 'complete';
            } else if (dataEntries > 0) {
              status = 'in_progress';
            } else {
              status = 'pending';
            }
          } else {
            evidenceCount = 'No data needed';
            status = 'complete'; // Task complete for data if no data needed
          }
        } else { // evidence mode
          if (needsFiles) {
            evidenceCount = `${attachments}/${requirements.expectedFiles} files`;
            // Complete if we have all required files
            if (attachments >= requirements.expectedFiles) {
              status = 'complete';
            } else if (attachments > 0) {
              status = 'in_progress';
            } else {
              status = 'pending';
            }
          } else {
            evidenceCount = 'No files needed';
            status = 'complete'; // Task complete for files if no files needed
          }
        }
      }
      
      return {
        name: task.title.length > 30 ? task.title.substring(0, 30) + '...' : task.title,
        status: status,
        evidence: evidenceCount
      };
    });
  };

  // Use database calculation with proper viewMode support
  const environmentalMetrics = getMetricsByCategory('environmental', viewMode);
  const socialMetrics = getMetricsByCategory('social', viewMode);
  const governanceMetrics = getMetricsByCategory('governance', viewMode);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete':
        return <span className="text-brand-green">✓ Complete</span>;
      case 'in_progress':
        return <span className="text-yellow-400">⏳ In Progress</span>;
      case 'pending':
        return <span className="text-red-400">✗ Pending</span>;
      default:
        return <span className="text-text-muted">Unknown</span>;
    }
  };



  // Generate next steps from actual database task data
  const getNextStepsFromDB = () => {
    if (!tasks || tasks.length === 0) {
      return [{
        id: 'no-tasks',
        title: 'No active tasks',
        description: 'All tasks are up to date',
        priority: 'low',
        action: 'Dashboard',
        icon: 'fa-check',
        color: 'green',
        isCompleted: true
      }];
    }

    // Find incomplete tasks using shared utilities
    const incompleteTasks = tasks.filter(task => {
      if (task.status === 'completed' || task.progress_percentage >= 100) {
        return false;
      }
      
      const requirements = getTaskRequirements(task);
      const actualFiles = (task.attachments || []).length;
      const actualDataEntries = task.data_entries ? 
        Object.keys(task.data_entries).filter(key => 
          task.data_entries[key] && 
          key !== 'notes' && 
          !key.includes('cost')
        ).length : 0;
      
      // Task is incomplete if it needs more files or data
      return actualFiles < requirements.expectedFiles || actualDataEntries < requirements.expectedDataFields;
    });

    if (incompleteTasks.length === 0) {
      return [{
        id: 'all-completed',
        title: '🎉 All Tasks Completed!',
        description: 'Congratulations! You have successfully completed all ESG compliance tasks.',
        priority: 'completed',
        action: 'Generate Reports',
        icon: 'fa-trophy',
        color: 'green',
        isCompleted: true,
        onClick: () => navigate('/reports')
      }];
    }

    // Show first 3 incomplete tasks
    return incompleteTasks.slice(0, 3).map(task => ({
      id: task.id,
      title: task.title,
      description: task.description || `${task.category} compliance task`,
      priority: task.status === 'in_progress' ? 'high' : 'medium',
      action: task.status === 'in_progress' ? 'Continue' : 'Start',
      icon: task.category === 'environmental' ? 'fa-leaf' :
            task.category === 'social' ? 'fa-users' : 'fa-shield-halved',
      color: task.status === 'in_progress' ? 'red' : 
             task.category === 'environmental' ? 'green' :
             task.category === 'social' ? 'blue' : 'yellow',
      isCompleted: false
    }));
  };

  const nextSteps = getNextStepsFromDB();

  const handleTaskAction = (taskId) => {
    // Navigate to tasks page with specific task highlighted
    navigate(`/tasks?highlight=${taskId}`);
  };


  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Progress Tracker</h1>
          <p className="text-text-muted text-lg">Track your ESG data completion and evidence upload progress</p>
        </div>

        {/* Progress Overview */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Data Progress Card */}
          <Card className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-brand-blue/20 rounded-lg flex items-center justify-center">
                  <i className="fa-solid fa-chart-line text-brand-blue text-xl"></i>
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Data Entered</h3>
                  <p className="text-text-muted text-sm">ESG metrics completion</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl md:text-3xl font-bold text-brand-blue px-2">{progress.dataProgress.overall}%</div>
                <div className="text-sm text-text-muted">
                  {progress.dataProgress.completed} of {progress.dataProgress.total} fields
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white/10 rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full bg-brand-blue rounded-full transition-all duration-1000"
                  style={{ width: `${progress.dataProgress.overall}%` }}
                ></div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <div className="text-lg font-semibold text-brand-green">{progress.dataProgress.environmental}%</div>
                  <div className="text-xs text-text-muted">Environmental</div>
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-semibold text-brand-blue">{progress.dataProgress.social}%</div>
                  <div className="text-xs text-text-muted">Social</div>
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-semibold text-brand-teal">{progress.dataProgress.governance}%</div>
                  <div className="text-xs text-text-muted">Governance</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Evidence Progress Card */}
          <Card className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-brand-teal/20 rounded-lg flex items-center justify-center">
                  <i className="fa-solid fa-file-upload text-brand-teal text-xl"></i>
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Evidence Uploaded</h3>
                  <p className="text-text-muted text-sm">Supporting documents</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl md:text-3xl font-bold text-brand-teal px-2">{progress.evidenceProgress.overall}%</div>
                <div className="text-sm text-text-muted">
                  {progress.evidenceProgress.completed} of {progress.evidenceProgress.total} files
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white/10 rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full bg-brand-teal rounded-full transition-all duration-1000"
                  style={{ width: `${progress.evidenceProgress.overall}%` }}
                ></div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <div className="text-lg font-semibold text-brand-green">{progress.evidenceProgress.environmental}%</div>
                  <div className="text-xs text-text-muted">Environmental</div>
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-semibold text-brand-blue">{progress.evidenceProgress.social}%</div>
                  <div className="text-xs text-text-muted">Social</div>
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-semibold text-brand-teal">{progress.evidenceProgress.governance}%</div>
                  <div className="text-xs text-text-muted">Governance</div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Detailed Breakdown */}
        <Card className="p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">Detailed Breakdown</h3>
            <div className="flex space-x-2">
              <button 
                onClick={() => setViewMode('data')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'data' 
                    ? 'bg-brand-green text-white' 
                    : 'bg-white/10 text-text-muted hover:bg-white/20'
                }`}
              >
                Data Entry
              </button>
              <button 
                onClick={() => setViewMode('evidence')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'evidence' 
                    ? 'bg-brand-green text-white' 
                    : 'bg-white/10 text-text-muted hover:bg-white/20'
                }`}
              >
                File Uploads
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {/* Environmental Metrics */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <i className="fa-solid fa-leaf text-brand-green"></i>
                  <span className="font-semibold">Environmental Metrics</span>
                </div>
                <span className="text-brand-green font-semibold">
                  {viewMode === 'data' ? progress.dataProgress.environmental : progress.evidenceProgress.environmental}% Complete
                </span>
              </div>
              <div className="bg-white/10 rounded-full h-2">
                <div 
                  className="h-full bg-brand-green rounded-full transition-all duration-1000"
                  style={{ 
                    width: `${viewMode === 'data' ? progress.dataProgress.environmental : progress.evidenceProgress.environmental}%` 
                  }}
                ></div>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                {environmentalMetrics.map((metric, index) => (
                  <div key={index} className="flex flex-col space-y-1">
                    <span className="text-text-muted text-xs">{metric.name}</span>
                    <div className="flex justify-between items-center">
                      {getStatusIcon(metric.status)}
                      {metric.evidence && (
                        <span className="text-xs text-text-muted bg-white/5 px-2 py-1 rounded">
                          {metric.evidence}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Social Metrics */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <i className="fa-solid fa-users text-brand-blue"></i>
                  <span className="font-semibold">Social Metrics</span>
                </div>
                <span className="text-brand-blue font-semibold">
                  {viewMode === 'data' ? progress.dataProgress.social : progress.evidenceProgress.social}% Complete
                </span>
              </div>
              <div className="bg-white/10 rounded-full h-2">
                <div 
                  className="h-full bg-brand-blue rounded-full transition-all duration-1000"
                  style={{ 
                    width: `${viewMode === 'data' ? progress.dataProgress.social : progress.evidenceProgress.social}%` 
                  }}
                ></div>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                {socialMetrics.map((metric, index) => (
                  <div key={index} className="flex flex-col space-y-1">
                    <span className="text-text-muted text-xs">{metric.name}</span>
                    <div className="flex justify-between items-center">
                      {getStatusIcon(metric.status)}
                      {metric.evidence && (
                        <span className="text-xs text-text-muted bg-white/5 px-2 py-1 rounded">
                          {metric.evidence}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Governance Metrics */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <i className="fa-solid fa-shield-halved text-brand-teal"></i>
                  <span className="font-semibold">Governance Metrics</span>
                </div>
                <span className="text-brand-teal font-semibold">
                  {viewMode === 'data' ? progress.dataProgress.governance : progress.evidenceProgress.governance}% Complete
                </span>
              </div>
              <div className="bg-white/10 rounded-full h-2">
                <div 
                  className="h-full bg-brand-teal rounded-full transition-all duration-1000"
                  style={{ 
                    width: `${viewMode === 'data' ? progress.dataProgress.governance : progress.evidenceProgress.governance}%` 
                  }}
                ></div>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                {governanceMetrics.map((metric, index) => (
                  <div key={index} className="flex flex-col space-y-1">
                    <span className="text-text-muted text-xs">{metric.name}</span>
                    <div className="flex justify-between items-center">
                      {getStatusIcon(metric.status)}
                      {metric.evidence && (
                        <span className="text-xs text-text-muted bg-white/5 px-2 py-1 rounded">
                          {metric.evidence}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Next Steps / Action Items */}
        <Card className="p-8">
          <h3 className="text-xl font-semibold mb-6">Next Steps</h3>
          <div className="space-y-4">
            {nextSteps.map((step, index) => (
              <div key={index} className={`flex items-center space-x-4 p-4 rounded-lg ${
                step.isCompleted 
                  ? 'bg-brand-green/10 border border-brand-green/30' 
                  : 'bg-white/5'
              }`}>
                <div className={`w-8 h-8 bg-${step.color}-500/20 rounded-lg flex items-center justify-center`}>
                  <i className={`fa-solid ${step.icon} text-${step.color}-400`}></i>
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{step.title}</div>
                  <div className="text-sm text-text-muted">{step.description}</div>
                </div>
                {!step.isCompleted ? (
                  <Button
                    variant="primary"
                    size="small"
                    onClick={() => handleTaskAction(step.id)}
                    className={`${
                      step.color === 'red' ? 'bg-brand-green hover:bg-brand-green/90' :
                      step.color === 'yellow' ? 'bg-brand-teal hover:bg-brand-teal/90' :
                      'bg-brand-blue hover:bg-brand-blue/90'
                    }`}
                  >
                    {step.action}
                  </Button>
                ) : (
                  <div className="flex items-center space-x-2 text-brand-green">
                    <i className="fa-solid fa-trophy"></i>
                    <span className="text-sm font-medium">Completed!</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default Tracker;