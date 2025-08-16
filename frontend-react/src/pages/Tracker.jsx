import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { esgAPI } from '../services/api';

const Tracker = () => {
  const [viewMode, setViewMode] = useState('data'); // 'data' or 'evidence'
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

  // Calculate progress from DATABASE/API task data - NO localStorage
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
      environmental: { filesExpected: 0, filesCompleted: 0, dataExpected: 0, dataCompleted: 0 },
      social: { filesExpected: 0, filesCompleted: 0, dataExpected: 0, dataCompleted: 0 },
      governance: { filesExpected: 0, filesCompleted: 0, dataExpected: 0, dataCompleted: 0 }
    };

    console.log('📊 TRACKER: Calculating progress from DATABASE tasks (no localStorage)...');
    
    tasks.forEach(task => {
      const category = task.category || 'general';
      
      // Get evidence requirements for this task  
      const evidenceInfo = getEvidenceTypeInfo(task.action_required || '', task.title || '');
      
      // Determine task completion from DATABASE status and attachments
      const taskAttachments = task.attachments || [];
      const isTaskCompleted = task.status === 'completed' || task.progress_percentage >= 100;
      
      // Debug task data from database
      console.log(`📋 DB Task: ${task.title?.slice(0, 40)}`);
      console.log(`  - Status: ${task.status}`);
      console.log(`  - Progress: ${task.progress_percentage}%`);
      console.log(`  - Completed: ${isTaskCompleted}`);
      console.log(`  - Attachments: ${taskAttachments.length}`);
      console.log(`  - Evidence Type: ${evidenceInfo.type}`);
      
      
      // Count actual FILES expected and uploaded (not just tasks)
      if (evidenceInfo.type === 'file') {
        // File upload task - count expected files and actual files uploaded
        const expectedFileCount = evidenceInfo.expectedCount || 1;
        totalFilesExpected += expectedFileCount;
        
        // Count actual files uploaded for this task
        const actualFilesUploaded = taskAttachments.length;
        totalFilesCompleted += Math.min(actualFilesUploaded, expectedFileCount);
        
        console.log(`  - Expected ${expectedFileCount} files, uploaded ${actualFilesUploaded}`);
        
        if (categoryStats[category]) {
          categoryStats[category].filesExpected += expectedFileCount;
          categoryStats[category].filesCompleted += Math.min(actualFilesUploaded, expectedFileCount);
        }
      } else if (evidenceInfo.type === 'data') {
        // Data entry task - count tasks completed
        totalDataFieldsExpected += 1;
        if (isTaskCompleted) {
          totalDataFieldsCompleted += 1;
        }
        
        console.log(`  - Data entry task, completed: ${isTaskCompleted}`);
        
        if (categoryStats[category]) {
          categoryStats[category].dataExpected += 1;
          if (isTaskCompleted) {
            categoryStats[category].dataCompleted += 1;
          }
        }
      } else if (evidenceInfo.type === 'mixed') {
        // Mixed task - check what was actually submitted
        if (taskAttachments.length > 0) {
          // Has files, count as file uploads
          const expectedFileCount = evidenceInfo.expectedCount || 1;
          totalFilesExpected += expectedFileCount;
          
          const actualFilesUploaded = taskAttachments.length;
          totalFilesCompleted += Math.min(actualFilesUploaded, expectedFileCount);
          
          console.log(`  - Mixed task with files: expected ${expectedFileCount}, uploaded ${actualFilesUploaded}`);
          
          if (categoryStats[category]) {
            categoryStats[category].filesExpected += expectedFileCount;
            categoryStats[category].filesCompleted += Math.min(actualFilesUploaded, expectedFileCount);
          }
        } else {
          // No files, treat as data entry
          totalDataFieldsExpected += 1;
          if (isTaskCompleted) {
            totalDataFieldsCompleted += 1;
          }
          
          console.log(`  - Mixed task with data entry, completed: ${isTaskCompleted}`);
          
          if (categoryStats[category]) {
            categoryStats[category].dataExpected += 1;
            if (isTaskCompleted) {
              categoryStats[category].dataCompleted += 1;
            }
          }
        }
      }
    });
    
    // Calculate overall percentages from DATABASE completion status
    const dataPercentage = totalDataFieldsExpected > 0 ? 
      (totalDataFieldsCompleted / totalDataFieldsExpected) * 100 : 0;
    
    const evidencePercentage = totalFilesExpected > 0 ? 
      (totalFilesCompleted / totalFilesExpected) * 100 : 0;
    
    // Calculate category percentages from DATABASE
    const calculateCategoryPercentage = (category, type) => {
      if (type === 'data') {
        const expected = categoryStats[category]?.dataExpected || 0;
        const completed = categoryStats[category]?.dataCompleted || 0;
        return expected > 0 ? (completed / expected) * 100 : 0;
      } else {
        const expected = categoryStats[category]?.filesExpected || 0;
        const completed = categoryStats[category]?.filesCompleted || 0;
        return expected > 0 ? (completed / expected) * 100 : 0;
      }
    };

    console.log('📊 TRACKER TOTALS FROM DATABASE:');
    console.log(`  Data Tasks: ${totalDataFieldsCompleted}/${totalDataFieldsExpected} (${Math.round(dataPercentage)}%)`);
    console.log(`  File Tasks: ${totalFilesCompleted}/${totalFilesExpected} (${Math.round(evidencePercentage)}%)`);
    console.log('📊 CATEGORY BREAKDOWN FROM DATABASE:');
    console.log('  Environmental:', categoryStats.environmental);
    console.log('  Social:', categoryStats.social);
    console.log('  Governance:', categoryStats.governance);

    return {
      dataProgress: {
        overall: Math.round(dataPercentage),
        completed: totalDataFieldsCompleted,
        total: totalDataFieldsExpected,
        environmental: Math.round(calculateCategoryPercentage('environmental', 'data')),
        social: Math.round(calculateCategoryPercentage('social', 'data')),
        governance: Math.round(calculateCategoryPercentage('governance', 'data'))
      },
      evidenceProgress: {
        overall: Math.round(evidencePercentage),
        completed: totalFilesCompleted,
        total: totalFilesExpected,
        environmental: Math.round(calculateCategoryPercentage('environmental', 'file')),
        social: Math.round(calculateCategoryPercentage('social', 'file')),
        governance: Math.round(calculateCategoryPercentage('governance', 'file'))
      }
    };
    
    // Helper function for evidence type detection (same as TaskDetail)
    function getEvidenceTypeInfo(dataSource, taskTitle = '') {
      const dataSourceLower = dataSource.toLowerCase();
      const titleLower = taskTitle.toLowerCase();
      const combined = `${dataSourceLower} ${titleLower}`;
      
      // Check for flexible evidence FIRST (user's choice between data or file)
      if (combined.includes('flexible evidence') || 
          combined.includes('your choice') || 
          combined.includes('flexible') && combined.includes('evidence') ||
          combined.includes('choice') && combined.includes('evidence')) {
        return { type: 'mixed', expectedCount: 1 };
      }
      
      // Check for utility bills FIRST (before meter detection)
      if (combined.includes('bills') || combined.includes('invoices')) {
        return { type: 'file', expectedCount: 3 };
      }
      
      // Meter-related tasks should support data entry (but NOT if it's mainly about IAQ/air quality)
      if ((combined.includes('meter') || combined.includes('dewa') || combined.includes('addc')) && 
          (combined.includes('track') || combined.includes('monitor') || combined.includes('consumption')) &&
          !combined.includes('air quality') && !combined.includes('iaq') && !combined.includes('indoor air')) {
        return { type: 'mixed', expectedCount: 1 }; // Support both data and files
      }
      
      // Data entry tasks - look for numeric/measurement keywords
      if (combined.includes('enter') || 
          combined.includes('percentage') ||
          combined.includes('kwh') || 
          combined.includes('m³') ||
          combined.includes('gallons') ||
          combined.includes('liters') ||
          combined.includes('tons') ||
          combined.includes('degrees') ||
          combined.includes('ppm') ||
          combined.includes('measurement') ||
          (combined.includes('track') && (combined.includes('consumption') || combined.includes('usage') || combined.includes('amount'))) ||
          (combined.includes('monitor') && (combined.includes('level') || combined.includes('quality') || combined.includes('temperature')))) {
        return { type: 'data', expectedCount: 1 };
      }
      
      // File upload patterns
      if (combined.includes('upload') || 
          combined.includes('bills') || 
          combined.includes('invoices') ||
          combined.includes('photo') ||
          combined.includes('picture') ||
          combined.includes('document') ||
          combined.includes('policy') ||
          combined.includes('certificate') ||
          combined.includes('records') || 
          combined.includes('logs') ||
          combined.includes('evidence') ||
          combined.includes('proof') ||
          combined.includes('signed')) {
        
        if (combined.includes('bills') || combined.includes('invoices')) {
          return { type: 'file', expectedCount: 3 };
        } else if (combined.includes('photo') || combined.includes('picture')) {
          // Check if it's mixed content (photos + documents) 
          if (combined.includes('agreement') || combined.includes('contract') || combined.includes('document')) {
            return { type: 'file', expectedCount: 2 }; // Accept all file types for mixed content
          } else {
            return { type: 'file', expectedCount: 2 }; // Photo-only tasks
          }
        } else {
          return { type: 'file', expectedCount: 1 };
        }
      }
      
      // Default to file upload if unclear
      return { type: 'file', expectedCount: 1 };
    }
  };

  // Use DATABASE task completion status (NO localStorage)
  const progress = calculateProgressFromDB();
  
  console.log('📊 PROGRESS TRACKER: Using DATABASE task completion status (NO localStorage)');
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

  // Generate dynamic metrics from DATABASE task completion (NO localStorage)
  // Filter by both category AND evidence type based on viewMode
  const getMetricsByCategory = (category) => {
    if (!tasks || tasks.length === 0) {
      return [
        { name: 'No tasks available', status: 'pending' }
      ];
    }

    const categoryTasks = tasks.filter(task => 
      task.category === category || task.title.toLowerCase().includes(category.toLowerCase())
    );

    // Filter by evidence type based on current viewMode
    const filteredTasks = categoryTasks.filter(task => {
      const evidenceInfo = getEvidenceTypeInfo(task.action_required || '', task.title || '');
      
      if (viewMode === 'data') {
        // Show only data entry tasks
        return evidenceInfo.type === 'data' || evidenceInfo.type === 'mixed';
      } else if (viewMode === 'evidence') {
        // Show only file upload tasks
        return evidenceInfo.type === 'file' || evidenceInfo.type === 'mixed';
      }
      
      return true; // fallback
    });

    if (filteredTasks.length === 0) {
      return [
        { name: `No ${viewMode === 'data' ? 'data entry' : 'file upload'} tasks`, status: 'pending' }
      ];
    }

    // Helper function for evidence type detection (same as calculateProgress)
    function getEvidenceTypeInfo(dataSource, taskTitle = '') {
      const dataSourceLower = dataSource.toLowerCase();
      const titleLower = taskTitle.toLowerCase();
      const combined = `${dataSourceLower} ${titleLower}`;
      
      // Check for utility bills FIRST (before meter detection)
      if (combined.includes('bills') || combined.includes('invoices')) {
        return { type: 'file', expectedCount: 3 };
      }
      
      // Meter-related tasks should support data entry (but NOT if it's mainly about IAQ/air quality)
      if ((combined.includes('meter') || combined.includes('dewa') || combined.includes('addc')) && 
          (combined.includes('track') || combined.includes('monitor') || combined.includes('consumption')) &&
          !combined.includes('air quality') && !combined.includes('iaq') && !combined.includes('indoor air')) {
        return { type: 'mixed', expectedCount: 1 };
      }
      
      // File upload tasks
      if (combined.includes('upload') || 
          combined.includes('bills') || 
          combined.includes('invoices') || 
          combined.includes('document') ||
          combined.includes('policy') ||
          combined.includes('certificate') ||
          combined.includes('records') || 
          combined.includes('logs') ||
          combined.includes('photo') ||
          combined.includes('evidence')) {
        
        if (combined.includes('bills') || combined.includes('invoices')) {
          return { type: 'file', expectedCount: 3 };
        } else if (combined.includes('photo')) {
          // Check if it's mixed content (photos + documents)
          if (combined.includes('agreement') || combined.includes('contract')) {
            return { type: 'file', expectedCount: 2 };
          } else {
            return { type: 'file', expectedCount: 2 };
          }
        } else if (combined.includes('records') || combined.includes('logs')) {
          return { type: 'file', expectedCount: 2 };
        } else {
          return { type: 'file', expectedCount: 1 };
        }
      }
      
      // Data entry tasks
      if (combined.includes('enter') || 
          combined.includes('percentage') ||
          combined.includes('kwh') || 
          combined.includes('m³') ||
          combined.includes('gallons') ||
          combined.includes('liters') ||
          combined.includes('tons') ||
          combined.includes('degrees') ||
          combined.includes('ppm') ||
          combined.includes('measurement') ||
          (combined.includes('track') && (combined.includes('consumption') || combined.includes('usage') || combined.includes('amount'))) ||
          (combined.includes('monitor') && (combined.includes('level') || combined.includes('quality') || combined.includes('temperature')))) {
        return { type: 'data', expectedCount: 1 };
      }
      
      return { type: 'file', expectedCount: 1 };
    }

    return filteredTasks.slice(0, 4).map(task => {
      // Use DATABASE task completion status (NO localStorage)
      const taskAttachments = task.attachments || [];
      const isTaskCompleted = task.status === 'completed' || task.progress_percentage >= 100;
      
      const evidenceInfo = getEvidenceTypeInfo(task.action_required || '', task.title || '');
      let taskStatus = 'pending';
      let evidenceCount;
      
      if (evidenceInfo.type === 'file') {
        // File upload task
        const expectedFiles = evidenceInfo.expectedCount || 1;
        const uploadedFiles = taskAttachments.length;
        
        if (uploadedFiles >= expectedFiles) {
          taskStatus = 'complete';
        } else if (uploadedFiles > 0) {
          taskStatus = 'in_progress';
        }
        
        evidenceCount = `${uploadedFiles}/${expectedFiles} files`;
        
      } else if (evidenceInfo.type === 'data') {
        // Data entry task
        if (isTaskCompleted) {
          taskStatus = 'complete';
          evidenceCount = '1/1 data entry';
        } else {
          evidenceCount = '0/1 data entry';
        }
        
      } else if (evidenceInfo.type === 'mixed') {
        // Mixed task
        const expectedCount = evidenceInfo.expectedCount || 1;
        
        if (taskAttachments.length > 0) {
          // Has files
          const uploadedFiles = taskAttachments.length;
          if (uploadedFiles >= expectedCount) {
            taskStatus = 'complete';
          } else if (uploadedFiles > 0) {
            taskStatus = 'in_progress';
          }
          evidenceCount = `${uploadedFiles}/${expectedCount} files`;
        } else if (isTaskCompleted) {
          // Data entry completed
          taskStatus = 'complete';
          evidenceCount = '1/1 data entry';
        } else {
          evidenceCount = `0/${expectedCount} files or data`;
        }
      }
      
      return {
        name: task.title.length > 30 ? task.title.substring(0, 30) + '...' : task.title,
        status: taskStatus,
        evidence: evidenceCount
      };
    });
  };

  const environmentalMetrics = getMetricsByCategory('environmental');
  const socialMetrics = getMetricsByCategory('social');  
  const governanceMetrics = getMetricsByCategory('governance');

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

  // Generate dynamic next steps from DATABASE task completion (NO localStorage)
  const getNextSteps = () => {
    if (!tasks || tasks.length === 0) {
      return [{
        title: 'No active tasks',
        description: 'All tasks are up to date',
        priority: 'low',
        action: 'Dashboard',
        icon: 'fa-check',
        color: 'green'
      }];
    }

    // Check for completed tasks using DATABASE completion status
    const completedTasks = tasks.filter(task => {
      const isTaskCompleted = task.status === 'completed' || task.progress_percentage >= 100;
      const taskAttachments = task.attachments || [];
      const evidenceInfo = getEvidenceTypeInfo(task.action_required || '', task.title || '');
      
      if (evidenceInfo.type === 'file') {
        // File task: check if enough files uploaded
        const expectedFiles = evidenceInfo.expectedCount || 1;
        return taskAttachments.length >= expectedFiles;
      } else if (evidenceInfo.type === 'data') {
        // Data task: check completion status
        return isTaskCompleted;
      } else if (evidenceInfo.type === 'mixed') {
        // Mixed task: completed if has files OR is marked complete
        const expectedFiles = evidenceInfo.expectedCount || 1;
        return taskAttachments.length >= expectedFiles || isTaskCompleted;
      }
      
      return isTaskCompleted;
    });

    // Check if ALL tasks are completed
    const allTasksCompleted = tasks.length > 0 && completedTasks.length === tasks.length;
    
    if (allTasksCompleted) {
      // Show general completion message when everything is done
      return [{
        id: 'all-completed',
        title: '🎉 All Tasks Completed!',
        description: 'Congratulations! You have successfully completed all ESG compliance tasks. Your data is ready for comprehensive reporting.',
        priority: 'completed',
        action: 'Generate Reports',
        icon: 'fa-trophy',
        color: 'green',
        isCompleted: true,
        onClick: () => window.location.href = '/reports'
      }];
    }

    // Show pending and in-progress tasks if not all completed
    const pendingTasks = tasks.filter(task => {
      const isTaskCompleted = task.status === 'completed' || task.progress_percentage >= 100;
      const taskAttachments = task.attachments || [];
      const evidenceInfo = getEvidenceTypeInfo(task.action_required || '', task.title || '');
      
      if (evidenceInfo.type === 'file') {
        const expectedFiles = evidenceInfo.expectedCount || 1;
        return taskAttachments.length < expectedFiles;
      } else if (evidenceInfo.type === 'data') {
        return !isTaskCompleted;
      } else if (evidenceInfo.type === 'mixed') {
        const expectedFiles = evidenceInfo.expectedCount || 1;
        return taskAttachments.length < expectedFiles && !isTaskCompleted;
      }
      
      return !isTaskCompleted;
    }).slice(0, 3);
    
    const regularNextSteps = pendingTasks.map(task => ({
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

    return regularNextSteps;
  };

  // Helper function for evidence type detection (same as calculateProgress)
  function getEvidenceTypeInfo(dataSource, taskTitle = '') {
    const dataSourceLower = dataSource.toLowerCase();
    const titleLower = taskTitle.toLowerCase();
    const combined = `${dataSourceLower} ${titleLower}`;
    
    // Check for flexible evidence FIRST (user's choice between data or file)
    if (combined.includes('flexible evidence') || 
        combined.includes('your choice') || 
        combined.includes('flexible') && combined.includes('evidence') ||
        combined.includes('choice') && combined.includes('evidence')) {
      return { type: 'mixed', expectedCount: 1 };
    }
    
    // Check for utility bills FIRST (before meter detection)
    if (combined.includes('bills') || combined.includes('invoices')) {
      return { type: 'file', expectedCount: 3 };
    }
    
    // Meter-related tasks should support data entry (but NOT if it's mainly about IAQ/air quality)
    if ((combined.includes('meter') || combined.includes('dewa') || combined.includes('addc')) && 
        (combined.includes('track') || combined.includes('monitor') || combined.includes('consumption')) &&
        !combined.includes('air quality') && !combined.includes('iaq') && !combined.includes('indoor air')) {
      return { type: 'mixed', expectedCount: 1 };
    }
    
    // Data entry tasks - look for numeric/measurement keywords
    if (combined.includes('enter') || 
        combined.includes('percentage') ||
        combined.includes('kwh') || 
        combined.includes('m³') ||
        combined.includes('gallons') ||
        combined.includes('liters') ||
        combined.includes('tons') ||
        combined.includes('degrees') ||
        combined.includes('ppm') ||
        combined.includes('measurement') ||
        (combined.includes('track') && (combined.includes('consumption') || combined.includes('usage') || combined.includes('amount'))) ||
        (combined.includes('monitor') && (combined.includes('level') || combined.includes('quality') || combined.includes('temperature')))) {
      return { type: 'data', expectedCount: 1 };
    }
    
    // File upload patterns
    if (combined.includes('upload') || 
        combined.includes('bills') || 
        combined.includes('invoices') ||
        combined.includes('photo') ||
        combined.includes('picture') ||
        combined.includes('document') ||
        combined.includes('policy') ||
        combined.includes('certificate') ||
        combined.includes('records') || 
        combined.includes('logs') ||
        combined.includes('evidence') ||
        combined.includes('proof') ||
        combined.includes('signed')) {
      
      if (combined.includes('bills') || combined.includes('invoices')) {
        return { type: 'file', expectedCount: 3 };
      } else if (combined.includes('photo') || combined.includes('picture')) {
        // Check if it's mixed content (photos + documents) 
        if (combined.includes('agreement') || combined.includes('contract') || combined.includes('document')) {
          return { type: 'file', expectedCount: 2 }; // Accept all file types for mixed content
        } else {
          return { type: 'file', expectedCount: 2 }; // Photo-only tasks
        }
      } else {
        return { type: 'file', expectedCount: 1 };
      }
    }
    
    // Default to file upload if unclear
    return { type: 'file', expectedCount: 1 };
  }

  const nextSteps = getNextSteps();

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
                Data
              </button>
              <button 
                onClick={() => setViewMode('evidence')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'evidence' 
                    ? 'bg-brand-green text-white' 
                    : 'bg-white/10 text-text-muted hover:bg-white/20'
                }`}
              >
                Evidence
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