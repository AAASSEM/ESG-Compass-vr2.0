import React, { useState, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import Layout from '../components/layout/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import TaskDetail from '../components/tasks/TaskDetail';
// import TestDataLoader from '../components/dev/TestDataLoader'; // Hidden for production
import UserAvatar from '../components/ui/UserAvatar';
import { useAuth } from '../contexts/AuthContext';
import { esgAPI } from '../services/api';
import { 
  getCategoryIcon, 
  getCategoryColor, 
  getCategoryLabel,
  getCategoryOptions,
  normalizeCategory,
  suggestTaskCategory,
  TASK_CATEGORIES
} from '../utils/categories';

const ItemType = 'TASK';

// Helper function to clean task title and add user answer
const cleanTaskTitle = (task) => {
  const originalTitle = task.title;
  
  // Remove meter information in parentheses since it's now shown in the Meter Tracking section
  const cleanTitle = originalTitle.replace(/\s*\(.*meter.*\)/i, '');
  
  return cleanTitle.trim();
};

// Helper function to format task title with user answer
const formatTaskTitleWithAnswer = (task) => {
  const cleanTitle = cleanTaskTitle(task);
  
  // If there's a user answer, append it to the title
  if (task.user_answer) {
    // Format different answer types
    let answerText = '';
    if (typeof task.user_answer === 'boolean') {
      answerText = task.user_answer ? 'Yes' : 'No';
    } else if (typeof task.user_answer === 'string') {
      // Capitalize first letter and limit length
      answerText = task.user_answer.charAt(0).toUpperCase() + task.user_answer.slice(1);
      if (answerText.length > 20) {
        answerText = answerText.substring(0, 20) + '...';
      }
    } else {
      answerText = String(task.user_answer);
    }
    
    return `${cleanTitle} (Answer: ${answerText})`;
  }
  
  return cleanTitle;
};

// Draggable Task Card Component
const TaskCard = ({ task, onEdit, onViewDetails, isHighlighted = false }) => {
  // Drag functionality disabled
  const isDragging = false;

  const getPriorityColor = (priority) => {
    const colors = {
      'high': '#ef4444',
      'medium': '#f59e0b',
      'low': '#10b981'
    };
    return colors[priority] || '#6b7280';
  };

  // Use centralized category system
  const normalizedCategory = normalizeCategory(task.category);
  const categoryIcon = getCategoryIcon(normalizedCategory);
  const categoryColor = getCategoryColor(normalizedCategory);

  return (
    <div
      className={`bg-white/5 border rounded-lg p-4 transition-all hover:bg-white/10 ${
        isHighlighted 
          ? 'border-brand-green bg-brand-green/10 shadow-lg shadow-brand-green/20' 
          : 'border-white/10'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className={`text-xs font-medium capitalize ${
            task.priority === 'high' ? 'text-red-600' :
            task.priority === 'medium' ? 'text-orange-600' :
            task.priority === 'low' ? 'text-green-600' :
            'text-gray-600'
          }`}>
            {task.priority} Priority
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <i className={`${categoryIcon} text-sm`} style={{ color: categoryColor }}></i>
        </div>
      </div>

      <h4 className="text-text-high font-medium text-sm mb-2 line-clamp-4" title={formatTaskTitleWithAnswer(task)}>
        {formatTaskTitleWithAnswer(task)}
      </h4>

      {task.description && (
        <p className="text-text-muted text-xs mb-3 line-clamp-2">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          {task.sector && (
            <span className="bg-brand-green/20 text-brand-green px-2 py-1 rounded text-xs">
              ESG {task.sector}
            </span>
          )}
          {task.task_type && !task.sector && (
            <span className="bg-white/10 text-text-muted px-2 py-1 rounded">
              {task.task_type.replace('_', ' ')}
            </span>
          )}
        </div>
        {task.due_date && (
          <span className={`${
            new Date(task.due_date) < new Date() ? 'text-red-400' : 'text-text-muted'
          }`}>
            {format(new Date(task.due_date), 'MMM dd')}
          </span>
        )}
      </div>

      {/* Evidence Indicator */}
      {task.action_required && (
        <div className="mt-2 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1 text-brand-orange">
            <i className="fa-solid fa-paperclip"></i>
            <span>Evidence Required</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(task);
            }}
            className="text-brand-green hover:text-brand-green/80 transition-colors"
          >
            View Details
          </button>
        </div>
      )}

      {/* Meter Information Display */}
      {(() => {
        // Extract meters dynamically for task card display
        const text = `${task?.action_required || ''} ${task?.description || ''} ${task?.title || ''}`.toLowerCase();
        const meterTypes = [];
        
        if (text.includes('electricity') || text.includes('electric') || text.includes('kwh') || text.includes('power')) {
          meterTypes.push({ type: 'electricity', icon: 'fa-bolt', color: 'text-green-400' });
        }
        if (text.includes('water') || text.includes('m³') || text.includes('cubic') || text.includes('hydro')) {
          meterTypes.push({ type: 'water', icon: 'fa-droplet', color: 'text-blue-400' });
        }
        if (text.includes('gas') || text.includes('natural gas') || text.includes('lng') || text.includes('fuel')) {
          meterTypes.push({ type: 'gas', icon: 'fa-fire', color: 'text-orange-400' });
        }
        
        return meterTypes.length > 0 && (
          <div className="mt-2 bg-brand-green/10 rounded-lg p-2">
            <div className="flex items-center space-x-1 mb-2">
              <i className="fa-solid fa-gauge text-brand-green text-xs"></i>
              <span className="text-brand-green text-xs font-medium">Meter Tracking</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {meterTypes.map((meter, index) => (
                <div key={index} className="flex items-center space-x-1 bg-white/10 rounded px-2 py-1">
                  <i className={`fa-solid ${meter.icon} ${meter.color} text-xs`}></i>
                  <span className="text-xs text-text-muted capitalize">{meter.type}</span>
                </div>
              ))}
            </div>
            {text.includes('bill') && (
              <div className="text-xs text-text-muted mt-1 flex items-center">
                <i className="fa-solid fa-file-invoice mr-1"></i>
                Bills required
              </div>
            )}
          </div>
        );
      })()}

      {task.framework_tags && task.framework_tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.framework_tags.slice(0, 2).map((framework, index) => (
            <span key={index} className="bg-brand-blue/20 text-brand-blue px-2 py-1 rounded text-xs">
              {framework}
            </span>
          ))}
          {task.framework_tags.length > 2 && (
            <span className="text-text-muted text-xs">+{task.framework_tags.length - 2} more</span>
          )}
        </div>
      )}

      {/* Assignment Info */}
      {task.assigned_user && (
        <div className="mt-3 flex items-center justify-between bg-white/5 rounded-lg p-2">
          <div className="flex items-center space-x-2">
            <UserAvatar 
              fullName={task.assigned_user.full_name}
              email={task.assigned_user.email}
              size="xs"
            />
            <span className="text-text-high text-xs font-medium">{task.assigned_user.full_name}</span>
          </div>
          <i className="fa-solid fa-user-tag text-brand-blue text-xs"></i>
        </div>
      )}

      {task.progress_percentage > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-text-muted">Progress</span>
            <span className="text-text-muted">{Math.round(task.progress_percentage)}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1">
            <div 
              className="bg-brand-green h-1 rounded-full transition-all"
              style={{ width: `${task.progress_percentage}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

// Drop Zone Column Component
const TaskColumn = ({ title, status, tasks, count, onDrop, children }) => {
  const [{ isOver }, drop] = useDrop({
    accept: ItemType,
    drop: (item) => {
      if (item.status !== status) {
        onDrop(item.id, status);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const getStatusColor = (status) => {
    const colors = {
      'todo': 'text-gray-400',
      'in_progress': 'text-brand-blue',
      'completed': 'text-brand-green',
      'blocked': 'text-red-400'
    };
    return colors[status] || 'text-gray-400';
  };

  return (
    <Card className={`min-h-[400px] ${isOver ? 'ring-2 ring-brand-green' : ''}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-text-high">{title}</h3>
        <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(status)} bg-white/10`}>
          {count}
        </span>
      </div>
      <div ref={drop} className="space-y-4 min-h-[300px]">
        {children}
      </div>
    </Card>
  );
};

const Tasks = () => {
  const { user } = useAuth();
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    priority: 'all',
    assignee: 'all'
  });
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [searchParams] = useSearchParams();
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);

  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors }
  } = useForm();

  // Load tasks from API only - no localStorage
  const { data: tasks, isLoading, error } = useQuery(
    ['tasks', user?.id, filters],
    async () => {
      try {
        
        // Use API only - backend already filters by company/user
        const apiTasks = await esgAPI.getTasks({});  // Backend filters by company automatically
        const tasksList = Array.isArray(apiTasks) ? apiTasks : apiTasks.results || [];
        
        return tasksList;
        
      } catch (error) {
        console.error('❌ Error loading API tasks:', error);
        console.error('Error details:', error.response?.data || error.message);
        console.error('Status:', error.response?.status, error.response?.statusText);
        
        // Return empty array on error - no localStorage fallback
        return [];
      }
    },
    {
      enabled: !!user?.id,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false
    }
  );

  // Filter tasks based on current filters
  const filteredTasks = tasks?.filter(task => {
    if (filters.status !== 'all' && task.status !== filters.status) {
      return false;
    }
    
    if (filters.category !== 'all') {
      const normalizedCategory = normalizeCategory(task.category);
      if (normalizedCategory !== filters.category) {
        return false;
      }
    }
    
    if (filters.priority !== 'all' && task.priority !== filters.priority) {
      return false;
    }
    
    if (filters.assignee !== 'all') {
      if (filters.assignee === 'assigned' && !task.assigned_to && !task.assigned_user) {
        return false;
      }
      if (filters.assignee === 'unassigned' && (task.assigned_to || task.assigned_user)) {
        return false;
      }
    }
    
    return true;
  }) || [];

  // Create/Update task mutation
  const saveTaskMutation = useMutation(
    async (data) => {
      // Prevent editing ESG tasks
      if (editingTask?.sector) {
        throw new Error('ESG compliance tasks cannot be edited to maintain audit integrity');
      }
      
      try {
        // Try API first
        return editingTask 
          ? await esgAPI.updateTask(editingTask.id, data)
          : await esgAPI.createTask(data);
      } catch (error) {
        console.warn('API save failed, saving to localStorage:', error);
        
        // Fallback to localStorage
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const companyId = currentUser.company_id || 'temp';
        const localTasks = JSON.parse(localStorage.getItem(`generatedTasks_${companyId}`) || '[]');
        
        if (editingTask) {
          // Update existing task (only non-ESG tasks)
          const updatedTasks = localTasks.map(task => 
            task.id === editingTask.id ? { ...task, ...data } : task
          );
          localStorage.setItem(`generatedTasks_${companyId}`, JSON.stringify(updatedTasks));
          return { ...editingTask, ...data };
        } else {
          // Create new task
          const newTask = {
            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...data,
            created_at: new Date().toISOString(),
            company_id: companyId
          };
          const updatedTasks = [...localTasks, newTask];
          localStorage.setItem(`generatedTasks_${companyId}`, JSON.stringify(updatedTasks));
          return newTask;
        }
      }
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['tasks', user?.id]);
        setShowTaskModal(false);
        setEditingTask(null);
        reset();
        toast.success(editingTask ? 'Task updated successfully!' : 'Task created successfully!');
      },
      onError: () => {
        toast.error('Failed to save task');
      }
    }
  );

  // Update task status mutation
  const updateTaskStatusMutation = useMutation(
    async ({ taskId, status }) => {
      try {
        // Try to update via API first
        return await esgAPI.updateTask(taskId, { status });
      } catch (error) {
        console.warn('API update failed, updating localStorage:', error);
        
        // Fallback to localStorage update
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const companyId = currentUser.company_id || 'temp';
        const localTasks = JSON.parse(localStorage.getItem(`generatedTasks_${companyId}`) || '[]');
        
        // Update the task in localStorage
        const updatedTasks = localTasks.map(task => 
          task.id === taskId ? { ...task, status } : task
        );
        
        localStorage.setItem(`generatedTasks_${companyId}`, JSON.stringify(updatedTasks));
        return { id: taskId, status };
      }
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['tasks', user?.id]);
        toast.success('Task status updated successfully!');
      },
      onError: () => {
        toast.error('Failed to update task status');
      }
    }
  );

  const taskTypeOptions = [
    { value: 'data_entry', label: 'Data Entry' },
    { value: 'evidence_upload', label: 'Evidence Upload' },
    { value: 'document_review', label: 'Document Review' },
    { value: 'compliance_check', label: 'Compliance Check' },
    { value: 'assessment_completion', label: 'Assessment Completion' }
  ];

  const categoryOptions = [
    { value: 'environmental', label: 'Environmental' },
    { value: 'social', label: 'Social' },
    { value: 'governance', label: 'Governance' },
    { value: 'general', label: 'General' }
  ];

  const priorityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' }
  ];

  const handleTaskSubmit = (data) => {
    const taskData = {
      title: data.title,
      description: data.description,
      task_type: data.task_type,
      category: data.category,
      priority: data.priority,
      due_date: data.due_date || null,
      estimated_hours: parseFloat(data.estimated_hours) || null,
      progress_percentage: parseFloat(data.progress_percentage) || 0,
      action_required: data.action_required,
      compliance_context: data.compliance_context,
      status: editingTask ? undefined : 'todo'
    };

    saveTaskMutation.mutate(taskData);
  };

  const handleEditTask = (task) => {
    // Prevent editing ESG tasks
    if (task.sector) {
      toast.error('ESG compliance tasks cannot be edited to maintain audit integrity');
      return;
    }
    
    setEditingTask(task);
    
    // Populate form
    setValue('title', task.title);
    setValue('description', task.description || '');
    setValue('task_type', task.task_type || 'data_entry');
    setValue('category', task.category);
    setValue('priority', task.priority);
    setValue('due_date', task.due_date ? task.due_date.split('T')[0] : '');
    setValue('estimated_hours', task.estimated_hours || '');
    setValue('progress_percentage', task.progress_percentage || 0);
    setValue('action_required', task.action_required || '');
    setValue('compliance_context', task.compliance_context || '');
    
    setShowTaskModal(true);
  };

  const handleViewTaskDetails = (task) => {
    setSelectedTask(task);
    setShowTaskDetail(true);
  };

  const handleTaskUpdate = async (updatedTask) => {
    try {
      // Try to update via API first
      await esgAPI.updateTask(updatedTask.id, {
        status: updatedTask.status,
        progress_percentage: updatedTask.progress_percentage,
        completion_notes: updatedTask.completion_notes
      });
    } catch (error) {
      console.warn('API update failed, using localStorage fallback:', error);
    }
    
    // Update task in localStorage (fallback)
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const companyId = currentUser.company_id || 'temp';
    const localTasks = JSON.parse(localStorage.getItem(`generatedTasks_${companyId}`) || '[]');
    
    const updatedTasks = localTasks.map(task => 
      task.id === updatedTask.id ? updatedTask : task
    );
    
    localStorage.setItem(`generatedTasks_${companyId}`, JSON.stringify(updatedTasks));
    
    // Refresh the query
    queryClient.invalidateQueries(['tasks', user?.id]);
    
    // Update selected task
    setSelectedTask(updatedTask);
  };

  const handleTaskDrop = (taskId, newStatus) => {
    const task = tasks?.find(t => t.id === taskId);
    
    // For ESG tasks, enforce proper workflow progression
    if (task?.sector) {
      const statusProgression = ['todo', 'in_progress', 'completed'];
      const currentIndex = statusProgression.indexOf(task.status);
      const newIndex = statusProgression.indexOf(newStatus);
      
      // Only allow forward progression for ESG tasks
      if (newIndex < currentIndex) {
        toast.error('ESG compliance tasks cannot be moved backwards to maintain audit integrity');
        return;
      }
      
      // Don't allow jumping from todo to completed without evidence
      if (task.status === 'todo' && newStatus === 'completed' && task.progress_percentage < 100) {
        toast.error('Please complete evidence collection before marking as completed');
        return;
      }
    }
    
    updateTaskStatusMutation.mutate({ taskId, status: newStatus });
  };

  const getTasksByStatus = (status) => {
    return filteredTasks?.filter(task => task.status === status) || [];
  };

  const getTaskStats = () => {
    if (!filteredTasks) return { total: 0, completed: 0, inProgress: 0, overdue: 0, assigned: 0, unassigned: 0 };

    const now = new Date();
    return {
      total: filteredTasks.length,
      completed: filteredTasks.filter(t => t.status === 'completed').length,
      inProgress: filteredTasks.filter(t => t.status === 'in_progress').length,
      overdue: filteredTasks.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== 'completed').length,
      assigned: filteredTasks.filter(t => t.assigned_user).length,
      unassigned: filteredTasks.filter(t => !t.assigned_user).length
    };
  };

  const stats = getTaskStats();

  // Handle task highlighting from URL params
  useEffect(() => {
    const highlightParam = searchParams.get('highlight');
    if (highlightParam && tasks) {
      setHighlightedTaskId(highlightParam);
      
      // Find and auto-open the highlighted task
      const highlightedTask = tasks.find(task => task.id === highlightParam);
      if (highlightedTask) {
        setSelectedTask(highlightedTask);
        setShowTaskDetail(true);
        
        // Clear highlight after 3 seconds
        setTimeout(() => setHighlightedTaskId(null), 3000);
      }
    }
  }, [searchParams, tasks]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  
  // Show error state if there's an error
  if (error) {
    console.error('❌ Tasks query error:', error);
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <Card className="p-8 text-center">
            <h2 className="text-xl font-semibold text-red-400 mb-4">Error Loading Tasks</h2>
            <p className="text-text-muted mb-4">
              {error.message || 'Failed to load tasks. Please try refreshing the page.'}
            </p>
            <Button onClick={() => window.location.reload()}>Refresh Page</Button>
          </Card>
        </div>
      </Layout>
    );
  }

  // Show empty state if no tasks
  if (!tasks || tasks.length === 0) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <Card className="p-8 text-center">
            <h2 className="text-xl font-semibold text-text-muted mb-4">No Tasks Found</h2>
            <p className="text-text-muted mb-4">
              Complete your onboarding to generate ESG compliance tasks, or create custom tasks manually.
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={() => window.location.href = '/onboard'}>Complete Onboarding</Button>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <Layout>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-text-high mb-2">Task Management</h1>
              <p className="text-text-muted">Manage your ESG implementation tasks and track progress</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-text-muted text-sm">
                ESG tasks are auto-generated from assessments
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <i className="fa-solid fa-filter mr-2"></i>
                Filter {filteredTasks.length !== tasks?.length && `(${filteredTasks.length}/${tasks?.length || 0})`}
              </Button>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-text-muted">Total Tasks</h3>
                <i className="fa-solid fa-tasks text-brand-green"></i>
              </div>
              <div className="text-2xl font-bold text-text-high">{stats.total}</div>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-text-muted">In Progress</h3>
                <i className="fa-solid fa-clock text-brand-blue"></i>
              </div>
              <div className="text-2xl font-bold text-brand-blue">{stats.inProgress}</div>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-text-muted">Completed</h3>
                <i className="fa-solid fa-check-circle text-brand-green"></i>
              </div>
              <div className="text-2xl font-bold text-brand-green">{stats.completed}</div>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-text-muted">Assigned</h3>
                <i className="fa-solid fa-user-tag text-purple-500"></i>
              </div>
              <div className="text-2xl font-bold text-purple-500">{stats.assigned}</div>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-text-muted">Unassigned</h3>
                <i className="fa-solid fa-user-slash text-orange-500"></i>
              </div>
              <div className="text-2xl font-bold text-orange-500">{stats.unassigned}</div>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-text-muted">Overdue</h3>
                <i className="fa-solid fa-exclamation-triangle text-red-500"></i>
              </div>
              <div className="text-2xl font-bold text-red-500">{stats.overdue}</div>
            </Card>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Select
                  label="Status"
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                  options={[
                    { value: 'all', label: 'All Status' },
                    { value: 'todo', label: 'To Do' },
                    { value: 'in_progress', label: 'In Progress' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'blocked', label: 'Blocked' }
                  ]}
                />
                <Select
                  label="Category"
                  value={filters.category}
                  onChange={(e) => setFilters({...filters, category: e.target.value})}
                  options={getCategoryOptions(true)}
                />
                <Select
                  label="Priority"
                  value={filters.priority}
                  onChange={(e) => setFilters({...filters, priority: e.target.value})}
                  options={[
                    { value: 'all', label: 'All Priorities' },
                    { value: 'high', label: 'High Priority' },
                    { value: 'medium', label: 'Medium Priority' },
                    { value: 'low', label: 'Low Priority' }
                  ]}
                />
                <Select
                  label="Assignee"
                  value={filters.assignee}
                  onChange={(e) => setFilters({...filters, assignee: e.target.value})}
                  options={[
                    { value: 'all', label: 'All Assignees' },
                    { value: 'assigned', label: 'Assigned' },
                    { value: 'unassigned', label: 'Unassigned' }
                  ]}
                />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-text-muted">
                  Showing {filteredTasks.length} of {tasks?.length || 0} tasks
                </span>
                <Button
                  variant="outline"
                  size="small"
                  onClick={() => setFilters({ status: 'all', category: 'all', priority: 'all', assignee: 'all' })}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          )}

          {/* ESG Tasks Notice */}
          {tasks && tasks.some(task => task.sector) && (
            <div className="mb-6">
              <div className="bg-brand-green/10 border border-brand-green/20 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <i className="fa-solid fa-leaf text-brand-green"></i>
                  <div>
                    <h4 className="text-text-high font-medium text-sm">ESG Compliance Tasks</h4>
                    <p className="text-text-muted text-xs">
                      These tasks were automatically generated from your ESG assessment answers. 
                      Upload evidence and track progress to achieve compliance. Tasks cannot be edited to maintain audit integrity.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Task Board */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <TaskColumn
              title="To Do"
              status="todo"
              tasks={getTasksByStatus('todo')}
              count={getTasksByStatus('todo').length}
              onDrop={handleTaskDrop}
            >
              {getTasksByStatus('todo').map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  onEdit={handleEditTask}
                  onViewDetails={handleViewTaskDetails}
                  isHighlighted={task.id === highlightedTaskId}
                />
              ))}
            </TaskColumn>

            <TaskColumn
              title="In Progress"
              status="in_progress"
              tasks={getTasksByStatus('in_progress')}
              count={getTasksByStatus('in_progress').length}
              onDrop={handleTaskDrop}
            >
              {getTasksByStatus('in_progress').map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  onEdit={handleEditTask}
                  onViewDetails={handleViewTaskDetails}
                  isHighlighted={task.id === highlightedTaskId}
                />
              ))}
            </TaskColumn>

            <TaskColumn
              title="Completed"
              status="completed"
              tasks={getTasksByStatus('completed')}
              count={getTasksByStatus('completed').length}
              onDrop={handleTaskDrop}
            >
              {getTasksByStatus('completed').map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  onEdit={handleEditTask}
                  onViewDetails={handleViewTaskDetails}
                  isHighlighted={task.id === highlightedTaskId}
                />
              ))}
            </TaskColumn>
          </div>

          {/* Task Modal - Only for non-ESG tasks */}
          {showTaskModal && !editingTask?.sector && (
            <Modal
              isOpen={showTaskModal}
              onClose={() => {
                setShowTaskModal(false);
                setEditingTask(null);
                reset();
              }}
              title={editingTask ? 'Edit Task' : 'Create New Task'}
              size="large"
            >
              <form onSubmit={handleSubmit(handleTaskSubmit)} className="space-y-6">
                <Input
                  label="Task Title"
                  placeholder="Enter task title"
                  required
                  error={errors.title?.message}
                  {...register('title', {
                    required: 'Task title is required'
                  })}
                />

                <div>
                  <label className="block text-text-high font-medium mb-2">Description</label>
                  <textarea
                    placeholder="Enter task description"
                    rows="3"
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-text-high placeholder-text-muted focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-colors resize-none"
                    {...register('description')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Task Type"
                    options={taskTypeOptions}
                    required
                    error={errors.task_type?.message}
                    {...register('task_type', {
                      required: 'Task type is required'
                    })}
                  />

                  <Select
                    label="Category"
                    options={categoryOptions}
                    required
                    error={errors.category?.message}
                    {...register('category', {
                      required: 'Category is required'
                    })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Priority"
                    options={priorityOptions}
                    required
                    error={errors.priority?.message}
                    {...register('priority', {
                      required: 'Priority is required'
                    })}
                  />

                  <Input
                    label="Due Date"
                    type="date"
                    {...register('due_date')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Estimated Hours"
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="e.g., 2.5"
                    {...register('estimated_hours')}
                  />

                  <Input
                    label="Progress %"
                    type="number"
                    min="0"
                    max="100"
                    defaultValue="0"
                    {...register('progress_percentage')}
                  />
                </div>

                <div>
                  <label className="block text-text-high font-medium mb-2">Action Required</label>
                  <textarea
                    placeholder="Specific action required to complete this task"
                    rows="2"
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-text-high placeholder-text-muted focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-colors resize-none"
                    {...register('action_required')}
                  />
                </div>

                <div>
                  <label className="block text-text-high font-medium mb-2">Compliance Context</label>
                  <textarea
                    placeholder="Why this task is important for compliance"
                    rows="2"
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-text-high placeholder-text-muted focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-colors resize-none"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowTaskModal(false);
                      setEditingTask(null);
                      reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={saveTaskMutation.isLoading}
                  >
                    {editingTask ? 'Update Task' : 'Create Task'}
                  </Button>
                </div>
              </form>
            </Modal>
          )}

          {/* Task Detail Modal */}
          <TaskDetail
            task={selectedTask}
            isOpen={showTaskDetail}
            onClose={() => {
              setShowTaskDetail(false);
              setSelectedTask(null);
            }}
            onUpdate={handleTaskUpdate}
          />

          {/* Test Data Loader (Development Only) - Hidden for production */}
          {process.env.NODE_ENV === 'development' && false && (
            <TestDataLoader />
          )}

        </div>
      </Layout>
    </DndProvider>
  );
};

export default Tasks;