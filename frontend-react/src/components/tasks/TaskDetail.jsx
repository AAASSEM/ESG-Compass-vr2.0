import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useQueryClient } from 'react-query';
import { format, subMonths } from 'date-fns';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Modal from '../ui/Modal';
import LoadingSpinner from '../ui/LoadingSpinner';
import UserAvatar from '../ui/UserAvatar';
import { esgAPI } from '../../services/api';
import { extractRequiredMonths, extractDataFields, extractRequiredDocuments, getMeterInfo, getTaskRequirements } from '../../utils/taskFieldExtraction';

const TaskDetail = ({ task, isOpen, onClose, onUpdate }) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [evidence, setEvidence] = useState([]);
  const [dataEntries, setDataEntries] = useState({});
  const [newEvidence, setNewEvidence] = useState({
    type: 'file',
    title: '',
    description: '',
    value: '',
    file: null,
    unit: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taskProgress, setTaskProgress] = useState(task?.progress_percentage || 0);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [monthlyUploads, setMonthlyUploads] = useState({});
  const [dataFields, setDataFields] = useState([]);
  const [history, setHistory] = useState([]);

  // Add entry to history
  const addHistoryEntry = (type, action, details = null) => {
    const entry = {
      id: Date.now(),
      type, // 'upload', 'data_entry', 'status_change', 'task_created', 'assignment'
      action,
      details,
      timestamp: new Date().toISOString(),
      user: JSON.parse(localStorage.getItem('user') || '{}').full_name || 'User'
    };
    
    setHistory(prev => [entry, ...prev]);
  };

  // Initialize history with task creation and existing evidence
  useEffect(() => {
    if (task && history.length === 0) {
      const initialHistory = [];
      
      // Task creation
      initialHistory.push({
        id: 'task_created',
        type: 'task_created',
        action: 'Task created by system',
        details: { title: task.title },
        timestamp: task.created_at || task.updated_at || new Date().toISOString(),
        user: 'System'
      });
      
      // Existing evidence uploads
      if (evidence && evidence.length > 0) {
        evidence.forEach((item, index) => {
          initialHistory.push({
            id: `evidence_${item.id}`,
            type: 'upload',
            action: 'User uploaded file',
            details: { filename: item.title, fileSize: item.file_size },
            timestamp: item.uploaded_at || task.updated_at || new Date().toISOString(),
            user: 'User'
          });
        });
      }
      
      // Sort by timestamp (newest first)
      initialHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setHistory(initialHistory);
    }
  }, [task, evidence]);

  // Extract required months and data fields from task
  useEffect(() => {
    if (task) {
      // Parse required months from action_required or description
      const months = extractRequiredMonths(task);
      const uploads = {};
      months.forEach(month => {
        uploads[month.key] = false;
      });
      setMonthlyUploads(uploads);

      // Parse required data fields
      const fields = extractDataFields(task);
      setDataFields(fields);
      
      // Initialize data entries
      const entries = {};
      fields.forEach(field => {
        entries[field.key] = '';
      });
      setDataEntries(entries);
    }
  }, [task]);






  // Helper function to match evidence to document requirements
  const getDocumentEvidence = (evidence, doc) => {
    return evidence.filter(e => {
      const evidenceTitle = e.title?.toLowerCase() || '';
      const evidenceDescription = e.description?.toLowerCase() || '';
      const docKey = doc.key.toLowerCase();
      const baseKey = docKey.split('_')[0]; // Get base key like 'utility_bills'
      
      // For meter-specific documents, try multiple matching strategies
      if (doc.meter) {
        const meterId = doc.meter.meter_id?.toLowerCase() || doc.meter.id?.toLowerCase() || '';
        const meterType = doc.meter.type?.toLowerCase() || '';
        
        // Strategy 1: Exact key match (new format)
        if (evidenceTitle.includes(docKey)) {
          return true;
        }
        
        // Strategy 2: Base key + meter ID match
        if (evidenceTitle.includes(baseKey) && evidenceTitle.includes(meterId)) {
          return true;
        }
        
        // Strategy 3: Base key + meter type match
        if (evidenceTitle.includes(baseKey) && evidenceTitle.includes(meterType)) {
          return true;
        }
        
        // Strategy 4: Check description for meter info
        if (evidenceDescription.includes(meterId) && evidenceTitle.includes(baseKey)) {
          return true;
        }
      }
      
      // For period-specific documents, match by base key and period info
      if (doc.period && doc.month) {
        const monthKey = doc.month.key?.toLowerCase() || '';
        if (evidenceTitle.includes(baseKey) && evidenceTitle.includes(monthKey)) {
          return true;
        }
      }
      
      // For general documents, use flexible matching
      // Since all documents are now "Supporting Documents", be more inclusive
      if (evidenceTitle.includes(docKey) || 
          evidenceTitle.includes(baseKey) ||
          evidenceDescription.includes(baseKey)) {
        return true;
      }
      
      // If no specific matching and this is the first/main document category, include all unmatched files
      const isFirstCategory = requiredDocuments.indexOf(doc) === 0;
      const isGeneralCategory = doc.key === 'general';
      
      if (isFirstCategory || isGeneralCategory) {
        // Check if this file is already matched to another document category
        const isMatchedElsewhere = requiredDocuments.some(otherDoc => {
          if (otherDoc.key === doc.key) return false; // Skip current doc
          const otherDocKey = otherDoc.key.toLowerCase();
          const otherBaseKey = otherDocKey.split('_')[0];
          return evidenceTitle.includes(otherDocKey) || 
                 evidenceTitle.includes(otherBaseKey) ||
                 evidenceDescription.includes(otherBaseKey);
        });
        
        return !isMatchedElsewhere;
      }
      
      return false;
    });
  };

  // Load team members
  useEffect(() => {
    const loadTeamMembers = async () => {
      if (showAssignModal && availableUsers.length === 0) {
        setLoadingUsers(true);
        try {
          const response = await esgAPI.getTeamMembers();
          let users = [];
          if (Array.isArray(response)) {
            users = response;
          } else if (response && Array.isArray(response.data)) {
            users = response.data;
          } else if (response && Array.isArray(response.results)) {
            users = response.results;
          } else if (response && Array.isArray(response.members)) {
            users = response.members;
          }
          setAvailableUsers(users);
        } catch (error) {
          console.error('Error loading team members:', error);
          toast.error('Failed to load team members');
          setAvailableUsers([]);
        } finally {
          setLoadingUsers(false);
        }
      }
    };
    loadTeamMembers();
  }, [showAssignModal, availableUsers.length]);

  useEffect(() => {
    if (task) {
      const taskAttachments = task.attachments || [];
      setEvidence(taskAttachments);
      setTaskProgress(task.progress_percentage || 0);
      
      // Load saved data entries from database
      if (task.data_entries) {
        console.log('📥 Loading saved data entries:', task.data_entries);
        setDataEntries(task.data_entries);
      } else {
        // Initialize empty data entries for the required fields
        const fields = extractDataFields(task);
        const entries = {};
        fields.forEach(field => {
          entries[field.key] = '';
        });
        setDataEntries(entries);
      }
    }
  }, [task]);

  // Reset to Overview tab when task changes or modal opens
  useEffect(() => {
    if (task && isOpen) {
      setActiveTab('overview');
    }
  }, [task?.id, isOpen]);

  const handleAssignUser = async (userId) => {
    const user = availableUsers.find(u => u.id === userId);
    if (!user) return;

    try {
      const updatedTask = await esgAPI.updateTask(task.id, {
        assigned_to: userId,
        assigned_at: new Date().toISOString()
      });

      if (onUpdate) {
        onUpdate({
          ...updatedTask,
          assigned_user: user
        });
      }

      setShowAssignModal(false);
      toast.success(`Task assigned to ${user.full_name}`);
      
      // Add to history
      addHistoryEntry('assignment', 'Task assigned to user', {
        assignedTo: user.full_name,
        assignedEmail: user.email,
        previousAssignee: task.assigned_user?.full_name || 'Unassigned'
      });
    } catch (error) {
      console.error('Error assigning task:', error);
      toast.error('Failed to assign task');
    }
  };

  const handleDataEntry = (field, value) => {
    console.log(`🔍 handleDataEntry called: field="${field}", value="${value}", type=${typeof value}`);
    const previousValue = dataEntries[field];
    
    const newDataEntries = {
      ...dataEntries,
      [field]: value
    };
    
    console.log('🔍 New data entries object:', newDataEntries);
    setDataEntries(newDataEntries);

    // Add to history if value changed
    if (value && value !== previousValue) {
      const fieldConfig = dataFields.find(f => f.key === field);
      // Create more specific action based on field type
      let actionMessage = 'User entered data';
      if (fieldConfig?.label?.toLowerCase().includes('reading')) {
        actionMessage = 'User entered meter reading';
      } else if (fieldConfig?.label?.toLowerCase().includes('cost')) {
        actionMessage = 'User entered cost data';
      } else if (fieldConfig?.label?.toLowerCase().includes('percentage')) {
        actionMessage = 'User entered percentage';
      } else if (fieldConfig?.label?.toLowerCase().includes('notes')) {
        actionMessage = 'User added notes';
      } else if (fieldConfig?.meter) {
        actionMessage = `User entered ${fieldConfig.meter.type} meter data`;
      }
      
      addHistoryEntry('data_entry', actionMessage, {
        field: fieldConfig?.label || field,
        value: fieldConfig?.unit ? `${value} ${fieldConfig.unit}` : value,
        previousValue: previousValue || 'Empty'
      });
    }
  };

  const saveDataEntry = async (field, value) => {
    try {
      const newDataEntries = {
        ...dataEntries,
        [field]: value
      };
      
      console.log('💾 Saving data entry on blur:', newDataEntries);
      await esgAPI.updateTask(task.id, {
        data_entries: newDataEntries
      });
      
      toast.success('Data saved', {
        position: 'bottom-right',
        autoClose: 2000
      });
      
      // Update progress after saving
      updateDataEntryProgress();
      
    } catch (error) {
      console.error('Error saving data entry:', error);
      toast.error('Failed to save data', {
        position: 'bottom-right',
        autoClose: 3000
      });
    }
  };

  const calculateOverallProgress = (currentEvidence = evidence) => {
    // Calculate data entry progress
    const requiredFields = dataFields.filter(f => f.required);
    const filledRequired = requiredFields.filter(f => dataEntries[f.key]).length;
    const dataProgress = requiredFields.length > 0 
      ? Math.round((filledRequired / requiredFields.length) * 100)
      : 100; // If no data required, consider it 100%
    
    // Calculate file upload progress - use extractRequiredDocuments directly to avoid scope issues
    const currentRequiredDocs = extractRequiredDocuments(task).filter(d => d.required);
    const uploadedDocs = currentEvidence.length;
    const fileProgress = currentRequiredDocs.length > 0 
      ? Math.round((uploadedDocs / currentRequiredDocs.length) * 100)
      : 100; // If no files required, consider it 100%
    
    // Overall progress calculation:
    // - If no data entry required: use file progress only
    // - If data entry required: average of both data and file progress
    const overallProgress = requiredFields.length === 0 
      ? fileProgress  // No data entry required, use file progress only
      : Math.round((dataProgress + fileProgress) / 2);  // Average both
    
    console.log('📊 Progress Calculation Debug:', {
      taskTitle: task?.title?.substring(0, 50) + '...',
      requiredFieldsCount: requiredFields.length,
      filledRequiredCount: filledRequired,
      requiredDocsCount: currentRequiredDocs.length,
      uploadedDocsCount: uploadedDocs,
      requiredDocTypes: currentRequiredDocs.map(d => d.key),
      dataProgress,
      fileProgress,
      overallProgress,
      calculationUsed: requiredFields.length === 0 ? 'fileProgress only' : 'average of both'
    });
    
    return { dataProgress, fileProgress, overallProgress };
  };

  const updateDataEntryProgress = async () => {
    const { overallProgress } = calculateOverallProgress();
    
    setTaskProgress(overallProgress);
    
    // Track status changes
    const oldStatus = task.status;
    const newStatus = overallProgress >= 100 ? 'completed' : (overallProgress > 0 ? 'in_progress' : task.status);
    
    // Save progress and data entries to database
    try {
      await esgAPI.updateTask(task.id, {
        progress_percentage: overallProgress,
        status: newStatus,
        data_entries: dataEntries // Save the actual data entries
      });
      
      // Add status change to history if status changed
      if (oldStatus !== newStatus) {
        if (newStatus === 'completed') {
          addHistoryEntry('status_change', 'Task completed automatically', {
            fromStatus: oldStatus,
            toStatus: newStatus,
            progress: overallProgress
          });
        } else if (newStatus === 'in_progress' && oldStatus === 'todo') {
          addHistoryEntry('status_change', 'Task started by user', {
            fromStatus: oldStatus,
            toStatus: newStatus,
            progress: overallProgress
          });
        }
      }
      
      // Update the task in parent component
      if (onUpdate) {
        onUpdate({
          ...task,
          progress_percentage: overallProgress,
          status: overallProgress >= 100 ? 'completed' : (overallProgress > 0 ? 'in_progress' : task.status),
          data_entries: dataEntries
        });
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries('tasks');
      queryClient.invalidateQueries('progress-tracker');
      
    } catch (error) {
      console.error('Error saving data entries:', error);
      toast.error('Failed to save data entries');
    }
  };

  const handleFileSelect = (event, documentKey = null, monthKey = null) => {
    const file = event.target.files[0];
    if (file) {
      validateAndSetFile(file, documentKey, monthKey);
    }
  };

  const validateAndSetFile = async (file, documentKey = null, monthKey = null) => {
    const maxBytes = 10 * 1024 * 1024; // 10MB
    
    if (file.size > maxBytes) {
      toast.error(`File size exceeds 10MB limit`);
      return;
    }
    
    // Update upload status
    if (monthKey) {
      setMonthlyUploads(prev => ({
        ...prev,
        [monthKey]: true
      }));
    }
    
    // Auto-upload the file immediately
    setIsSubmitting(true);
    
    try {
      console.log('🔄 Starting file upload:', file.name, 'Size:', file.size, 'Type:', file.type);
      console.log('📋 Task ID:', task.id);
      console.log('🔐 Auth token exists:', !!localStorage.getItem('access_token'));
      
      const fileTitle = file.name.replace(/\.[^/.]+$/, "");
      const uploadedAttachment = await esgAPI.uploadTaskAttachment(task.id, {
        file: file,
        title: fileTitle,
        description: `Uploaded file: ${file.name}`,
        attachment_type: 'evidence'
      });
      
      console.log('✅ Upload successful:', uploadedAttachment);

      const updatedEvidence = [...evidence, uploadedAttachment];
      setEvidence(updatedEvidence);

      // Update overall progress after file upload
      const { overallProgress } = calculateOverallProgress(updatedEvidence);
      setTaskProgress(overallProgress);

      await esgAPI.updateTask(task.id, {
        progress_percentage: overallProgress,
        status: overallProgress >= 100 ? 'completed' : (overallProgress > 0 ? 'in_progress' : task.status)
      });

      setIsSubmitting(false);
      toast.success(`File "${file.name}" uploaded successfully!`);
      
      // Add to history
      addHistoryEntry('upload', 'User uploaded file', { 
        filename: file.name, 
        fileSize: file.size,
        progressBefore: taskProgress,
        progressAfter: overallProgress
      });

      queryClient.invalidateQueries('progress-tracker');
      queryClient.invalidateQueries('tasks');

      if (onUpdate) {
        onUpdate({
          ...task,
          attachments: updatedEvidence,
          progress_percentage: overallProgress,
          status: overallProgress >= 100 ? 'completed' : (overallProgress > 0 ? 'in_progress' : task.status)
        });
      }

    } catch (error) {
      console.error('Error uploading file:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error message:', error.message);
      
      setIsSubmitting(false);
      
      // Show detailed error message
      let errorMessage = `Failed to upload "${file.name}"`;
      if (error.response?.data?.error) {
        errorMessage += `: ${error.response.data.error}`;
      } else if (error.response?.status === 413) {
        errorMessage += ': File too large (max 10MB)';
      } else if (error.response?.status === 401) {
        errorMessage += ': Authentication required';
      } else if (error.response?.status === 403) {
        errorMessage += ': Permission denied';
      } else if (error.response?.status >= 500) {
        errorMessage += ': Server error - please try again';
      } else if (error.message?.includes('Network Error')) {
        errorMessage += ': Network connection error';
      } else if (error.response?.status) {
        errorMessage += `: Server error (${error.response.status})`;
      }
      
      toast.error(errorMessage);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const handleAddEvidence = async () => {
    if (!newEvidence.title) {
      toast.error('Please provide a title for this evidence');
      return;
    }

    if (newEvidence.type === 'file' && !newEvidence.file) {
      toast.error('Please select a file to upload');
      return;
    }

    if (newEvidence.type === 'data' && !newEvidence.value) {
      toast.error('Please enter the required data');
      return;
    }

    setIsSubmitting(true);

    try {
      let uploadedAttachment;
      
      if (newEvidence.type === 'file') {
        uploadedAttachment = await esgAPI.uploadTaskAttachment(task.id, {
          file: newEvidence.file,
          title: newEvidence.title,
          description: newEvidence.description,
          attachment_type: 'evidence'
        });
      } else {
        const dataValue = newEvidence.unit ? `${newEvidence.value} ${newEvidence.unit}` : newEvidence.value;
        const textFile = new Blob([dataValue], { type: 'text/plain' });
        uploadedAttachment = await esgAPI.uploadTaskAttachment(task.id, {
          file: new File([textFile], `${newEvidence.title}.txt`, { type: 'text/plain' }),
          title: newEvidence.title,
          description: `Data entry: ${dataValue}\n\n${newEvidence.description}`,
          attachment_type: 'data_evidence'
        });
      }

      const updatedEvidence = [...evidence, uploadedAttachment];
      setEvidence(updatedEvidence);

      // Update overall progress after file upload
      const { overallProgress } = calculateOverallProgress(updatedEvidence);
      setTaskProgress(overallProgress);

      await esgAPI.updateTask(task.id, {
        progress_percentage: overallProgress,
        status: overallProgress >= 100 ? 'completed' : (overallProgress > 0 ? 'in_progress' : task.status)
      });

      setNewEvidence({
        type: 'file',
        title: '',
        description: '',
        value: '',
        file: null,
        unit: ''
      });

      setIsSubmitting(false);
      toast.success('Evidence uploaded successfully!');

      queryClient.invalidateQueries('progress-tracker');
      queryClient.invalidateQueries('tasks');

      if (onUpdate) {
        onUpdate({
          ...task,
          attachments: updatedEvidence,
          progress_percentage: overallProgress,
          status: overallProgress >= 100 ? 'completed' : (overallProgress > 0 ? 'in_progress' : task.status)
        });
      }

    } catch (error) {
      console.error('Error adding evidence:', error);
      setIsSubmitting(false);
      toast.error('Failed to upload evidence');
    }
  };

  const handleRemoveEvidence = async (evidenceId) => {
    try {
      const removedEvidence = evidence.find(e => e.id === evidenceId);
      await esgAPI.deleteTaskAttachment(task.id, evidenceId);
      const updatedEvidence = evidence.filter(e => e.id !== evidenceId);
      setEvidence(updatedEvidence);
      
      // Update overall progress after file upload
      const { overallProgress } = calculateOverallProgress(updatedEvidence);
      setTaskProgress(overallProgress);
      
      // Add to history
      addHistoryEntry('upload', 'User removed file', {
        filename: removedEvidence?.title || 'Unknown file',
        progressBefore: taskProgress,
        progressAfter: overallProgress
      });
      
      toast.success('Evidence removed');
    } catch (error) {
      console.error('Error removing evidence:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error message:', error.message);
      
      // Show detailed error message
      let errorMessage = 'Failed to remove evidence';
      if (error.response?.data?.error) {
        errorMessage += `: ${error.response.data.error}`;
      } else if (error.response?.status === 404) {
        errorMessage += ': File not found';
      } else if (error.response?.status === 403) {
        errorMessage += ': Permission denied';
      } else if (error.response?.status >= 500) {
        errorMessage += ': Server error';
      } else if (error.message?.includes('Network Error')) {
        errorMessage += ': Network connection error';
      }
      
      toast.error(errorMessage);
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'high': 'text-red-400',
      'medium': 'text-amber-400',
      'low': 'text-green-400'
    };
    return colors[priority] || 'text-text-muted';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'environmental': 'fa-solid fa-leaf text-brand-green',
      'social': 'fa-solid fa-users text-brand-blue',
      'governance': 'fa-solid fa-shield-halved text-purple-400',
      'general': 'fa-solid fa-tasks text-text-muted'
    };
    return icons[category] || 'fa-solid fa-tasks text-text-muted';
  };

  // Helper function to clean task title by removing meter information
  const cleanTaskTitle = (task) => {
    const originalTitle = task.title;
    
    // Remove meter information in parentheses since it's now shown in the Action Required section
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
      
      return `${cleanTitle} - Your answer: ✓ ${answerText}`;
    }
    
    return cleanTitle;
  };

  if (!task) return null;

  const meterInfo = getMeterInfo(task);
  
  // Check if this task has meter-related content and should use our clean dynamic instructions
  const needsDynamicMeterInstructions = (() => {
    const text = `${task?.action_required || ''} ${task?.description || ''} ${task?.title || ''}`.toLowerCase();
    
    // Exclude fuel/generator tasks - they need purchase receipts, not meter readings
    if (text.includes('fuel') && (text.includes('generator') || text.includes('diesel') || text.includes('petrol'))) {
      return false;
    }
    
    // Exclude LPG tasks - they need purchase invoices, not meter readings
    if (text.includes('lpg') && (text.includes('cooking') || text.includes('heating'))) {
      return false;
    }
    
    // Exclude cooling tasks - they need service bills, not meter readings
    if (text.includes('cooling') || text.includes('district cooling')) {
      return false;
    }
    
    return (text.includes('meter') || 
            text.includes('consumption') || 
            text.includes('electricity') || 
            text.includes('water') || 
            text.includes('gas')) && 
            meterInfo && meterInfo.length > 0;
  })();
  
  // Extract clean action required text (remove the verbose meter instructions if present)
  const getCleanActionRequired = () => {
    const actionRequired = task?.action_required || '';
    const taskText = `${task?.title || ''} ${task?.description || ''}`.toLowerCase();
    
    console.log('🔍 DEBUG getCleanActionRequired:', {
      taskTitle: task?.title,
      taskText: taskText,
      actionRequired: actionRequired.substring(0, 100) + '...',
      hasDistrictCooling: taskText.includes('district cooling'),
      actionHasDistrictCooling: actionRequired.toLowerCase().includes('district cooling')
    });
    
    // Handle district cooling tasks - they don't need meter details
    if (taskText.includes('district cooling') || actionRequired.toLowerCase().includes('district cooling')) {
      console.log('🔍 DEBUG: Returning district cooling bills');
      return 'Monthly district cooling bills';
    }
    
    // Handle fuel/generator tasks - they don't need meter details
    if (taskText.includes('fuel') || taskText.includes('generator') || taskText.includes('diesel') || taskText.includes('petrol')) {
      if (actionRequired.includes('fuel') && actionRequired.includes('receipt')) {
        return 'Fuel purchase receipts and consumption records';
      }
      return 'Purchase receipts and consumption records';
    }
    
    // For tasks that incorrectly have meter details but shouldn't (cooling tasks)
    if ((taskText.includes('cooling') || taskText.includes('lpg')) && actionRequired.includes('Read meters')) {
      // Override incorrect meter instructions for cooling/LPG tasks
      if (taskText.includes('cooling')) {
        return 'Monthly cooling service bills';
      } else if (taskText.includes('lpg')) {
        return 'LPG purchase receipts and usage records';
      }
    }
    
    // If it contains "Specific Action:" - extract and clean the main action
    if (actionRequired.includes('Specific Action:')) {
      const specificActionPart = actionRequired.split('Specific Action:')[1];
      if (specificActionPart) {
        // Extract the main action before the detailed meter list
        const lines = specificActionPart.split('\n');
        const mainAction = lines[0]?.replace(':', '').trim();
        
        if (mainAction && mainAction.length > 0) {
          // Clean up common patterns
          if (mainAction.includes('Read meters') && mainAction.includes('utility bills')) {
            return 'Read meters and record monthly consumption from utility bills';
          }
          return mainAction;
        }
      }
      
      // Fallback: extract main part before "Specific Action:"
      const mainPart = actionRequired.split('Specific Action:')[0].trim();
      return mainPart.replace(/^Action Required:\s*/i, '').trim();
    }
    
    // For very long action texts, provide a summary
    if (actionRequired.length > 200) {
      const firstSentence = actionRequired.split('.')[0];
      if (firstSentence.length < 100) {
        return firstSentence.replace(/^Action Required:\s*/i, '').trim();
      }
    }
    
    return actionRequired.replace(/^Action Required:\s*/i, '').trim();
  };
  
  const requiredDocuments = extractRequiredDocuments(task);
  const months = extractRequiredMonths(task);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Task Details & Evidence"
      size="large"
    >
      <div className="space-y-6">
        {/* Task Header */}
        <div className="border-b border-white/10 pb-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-brand-green/20 rounded-lg flex items-center justify-center">
                <i className={getCategoryIcon(task.category)}></i>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-high">{formatTaskTitleWithAnswer(task)}</h3>
                <div className="flex items-center space-x-4 mt-1">
                  <span className={`text-sm font-medium ${getPriorityColor(task.priority)} flex items-center`}>
                    <span className="w-2 h-2 rounded-full bg-current mr-1"></span>
                    {task.priority.toUpperCase()} Priority
                  </span>
                  {task.due_date && (
                    <span className="text-sm text-text-muted">
                      <i className="fa-regular fa-calendar mr-1"></i>
                      Due: {format(new Date(task.due_date), 'MMM dd, yyyy')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 border-b border-white/10">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === 'overview'
                ? 'text-brand-green'
                : 'text-text-muted hover:text-text-high'
            }`}
          >
            <span className="flex items-center space-x-2">
              <i className="fa-solid fa-chart-pie"></i>
              <span>Overview</span>
            </span>
            {activeTab === 'overview' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-green"></div>
            )}
          </button>
          
          {dataFields.length > 0 && (
            <button
              onClick={() => setActiveTab('data-entry')}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                activeTab === 'data-entry'
                  ? 'text-brand-green'
                  : 'text-text-muted hover:text-text-high'
              }`}
            >
              <span className="flex items-center space-x-2">
                <i className="fa-solid fa-keyboard"></i>
                <span>Data Entry</span>
                <span className="bg-white/10 px-2 py-0.5 rounded-full text-xs">
                  {dataFields.filter(f => f.required).length}
                </span>
              </span>
              {activeTab === 'data-entry' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-green"></div>
              )}
            </button>
          )}
          
          <button
            onClick={() => setActiveTab('evidence')}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === 'evidence'
                ? 'text-brand-green'
                : 'text-text-muted hover:text-text-high'
            }`}
          >
            <span className="flex items-center space-x-2">
              <i className="fa-solid fa-folder-open"></i>
              <span>Evidence Upload</span>
              <span className="bg-white/10 px-2 py-0.5 rounded-full text-xs">
                {evidence.length}/{requiredDocuments.filter(d => d.required).length}
              </span>
            </span>
            {activeTab === 'evidence' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-green"></div>
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === 'history'
                ? 'text-brand-green'
                : 'text-text-muted hover:text-text-high'
            }`}
          >
            <span className="flex items-center space-x-2">
              <i className="fa-solid fa-clock-rotate-left"></i>
              <span>History</span>
            </span>
            {activeTab === 'history' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-green"></div>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Priority Badge */}
              <div className="flex items-center space-x-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  task.priority === 'high' 
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : task.priority === 'medium'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-green-500/20 text-green-400 border border-green-500/30'
                }`}>
                  <span className="w-2 h-2 rounded-full bg-current mr-2"></span>
                  {task.priority.toUpperCase()} PRIORITY
                  {task.due_date && (
                    <>
                      <span className="mx-2">•</span>
                      Due: {format(new Date(task.due_date), 'MMM dd, yyyy')}
                    </>
                  )}
                </span>
              </div>

              {/* Assignment Section */}
              <Card className="bg-white/5 border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <i className="fa-solid fa-user-tag text-brand-blue text-lg"></i>
                    <div>
                      <h4 className="text-sm font-medium text-text-high">Task Assignment</h4>
                      {task.assigned_user ? (
                        <div className="flex items-center space-x-2 mt-2">
                          <UserAvatar 
                            fullName={task.assigned_user.full_name}
                            email={task.assigned_user.email}
                            size="sm"
                          />
                          <div>
                            <div className="text-sm text-text-high font-medium">
                              {task.assigned_user.full_name}
                            </div>
                            <div className="text-xs text-text-muted">
                              {task.assigned_user.department || task.assigned_user.role || 'Team Member'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-text-muted">No user assigned</span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="small"
                    variant={task.assigned_user ? "outline" : "primary"}
                    onClick={() => setShowAssignModal(true)}
                  >
                    {task.assigned_user ? 'Change Assignee' : 'Assign User'}
                  </Button>
                </div>
              </Card>

              {/* Compliance Context */}
              {task.compliance_context && (
                <Card className="bg-brand-blue/10 border-brand-blue/20">
                  <h4 className="text-sm font-medium text-brand-blue mb-2 flex items-center">
                    <i className="fa-solid fa-clipboard-check mr-2"></i>
                    Compliance Context
                  </h4>
                  <p className="text-sm text-text-high">{task.compliance_context}</p>
                </Card>
              )}

              {/* Meter Information - Only show for meter-related tasks, exclude fuel/generator tasks */}
              {meterInfo && meterInfo.length > 0 && 
               !task?.title?.toLowerCase().includes('fuel') && 
               !task?.title?.toLowerCase().includes('generator') && 
               !task?.title?.toLowerCase().includes('lpg') &&
               !task?.title?.toLowerCase().includes('cooling') &&
               !task?.title?.toLowerCase().includes('district cooling') &&
               (task?.title?.toLowerCase().includes('meter') || 
               task?.title?.toLowerCase().includes('electricity') || 
               task?.title?.toLowerCase().includes('water') || 
               task?.title?.toLowerCase().includes('gas') ||
               task?.action_required?.toLowerCase().includes('meter')) && (
                <Card className="bg-brand-green/10 border-brand-green/20">
                  <h4 className="text-sm font-medium text-brand-green mb-3 flex items-center">
                    <i className="fa-solid fa-gauge mr-2"></i>
                    Meter Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {meterInfo.map((meter, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                          <i className={`fa-solid ${meter.icon} text-brand-green text-sm`}></i>
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-text-muted">{meter.type}</div>
                          <div className="text-sm text-text-high font-medium">{meter.meter_id || meter.id}</div>
                          <div className="text-xs text-text-muted">{meter.location} • {meter.provider}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Meter Warning - Show when task needs meters but none are found OR some are missing */}
              {(() => {
                const text = `${task?.action_required || ''} ${task?.description || ''} ${task?.title || ''}`.toLowerCase();
                const taskNeedsMeters = text.includes('meter') || text.includes('electricity') || text.includes('water') || text.includes('gas') || 
                                       text.includes('consumption') || text.includes('read meters') || text.includes('utility bills');
                const hasMeters = meterInfo && meterInfo.length > 0;
                const hasMissingMeters = hasMeters && meterInfo[0]?.missingMeterTypes?.length > 0;
                const isExcludedTask = task?.title?.toLowerCase().includes('fuel') || 
                                      task?.title?.toLowerCase().includes('generator') || 
                                      task?.title?.toLowerCase().includes('lpg') || 
                                      task?.title?.toLowerCase().includes('cooling');
                
                return taskNeedsMeters && (!hasMeters || hasMissingMeters) && !isExcludedTask;
              })() && (
                <Card className="bg-amber-500/10 border-amber-500/20">
                  <h4 className="text-sm font-medium text-amber-500 mb-3 flex items-center">
                    <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                    {meterInfo && meterInfo.length > 0 ? 'Missing Meter Types' : 'Meter Setup Required'}
                  </h4>
                  <div className="space-y-3">
                    {meterInfo && meterInfo.length > 0 && meterInfo[0]?.missingMeterTypes ? (
                      <>
                        <p className="text-sm text-text-high">
                          This task requires multiple meter types, but some are missing from your location settings.
                        </p>
                        <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/10">
                          <div className="text-sm text-text-high mb-2">
                            <strong>Available meters:</strong> You can enter data for {meterInfo.map(m => m.type).join(', ')} meters.
                          </div>
                          <div className="text-sm text-amber-600">
                            <strong>Missing meters:</strong> Please add {meterInfo[0].missingMeterTypes.join(', ')} meter{meterInfo[0].missingMeterTypes.length > 1 ? 's' : ''} to your location settings.
                          </div>
                        </div>
                        <div className="text-xs text-text-muted">
                          <strong>Note:</strong> You can still complete this task with the available meter data. Add the missing meters in your location settings for complete data tracking.
                        </div>
                      </>
                    ) : (
                      (() => {
                        // Determine what meter types are required for this task
                        const text = `${task?.action_required || ''} ${task?.description || ''} ${task?.title || ''}`.toLowerCase();
                        const requiredMeterTypes = [];
                        if (text.includes('electricity') || text.includes('electric') || text.includes('kwh') || text.includes('power')) {
                          requiredMeterTypes.push('electricity');
                        }
                        if (text.includes('water') || text.includes('m³') || text.includes('cubic meter')) {
                          requiredMeterTypes.push('water');
                        }
                        if (text.includes('gas') || text.includes('natural gas') || text.includes('lpg') || text.includes('cooking gas') || text.includes('heating gas')) {
                          requiredMeterTypes.push('gas');
                        }
                        
                        return (
                          <>
                            <p className="text-sm text-text-high">
                              This task requires {requiredMeterTypes.length > 0 ? requiredMeterTypes.join(', ') + ' meter' + (requiredMeterTypes.length > 1 ? 's' : '') : 'meter readings'}, but no meters have been found in your location settings.
                            </p>
                            <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/10">
                              <div className="flex items-start space-x-2">
                                <i className="fa-solid fa-info-circle text-amber-500 text-sm mt-0.5"></i>
                                <div className="text-sm text-text-high">
                                  <strong>Next Steps:</strong> Please add {requiredMeterTypes.length > 0 ? requiredMeterTypes.join(', ') + ' meter' + (requiredMeterTypes.length > 1 ? 's' : '') : 'the required meters'} in your location settings first. 
                                  You can find this in the onboarding section under "Location & Meter Setup".
                                </div>
                              </div>
                            </div>
                            <div className="text-xs text-text-muted">
                              <strong>Note:</strong> Data entry fields will appear automatically once you add the required meters to your location.
                            </div>
                          </>
                        );
                      })()
                    )}
                  </div>
                </Card>
              )}

              {/* Action Required */}
              {task.action_required && (
                <Card className="bg-amber-500/10 border-amber-500/20">
                  <h4 className="text-sm font-medium text-amber-500 mb-4 flex items-center">
                    <i className="fa-solid fa-tasks mr-2"></i>
                    Action Required
                  </h4>
                  
                  {/* Main question/task from database - only for non-meter tasks */}
                  {!needsDynamicMeterInstructions && task.action_required && (
                    <div className="mb-4">
                      <div className="text-sm text-text-high">
                        <strong>Evidence Required:</strong> {getCleanActionRequired()}
                      </div>
                    </div>
                  )}
                  
                  {/* Clean meter instructions - replace verbose database text */}
                  {needsDynamicMeterInstructions && (
                    <div className="mb-4">
                      <div className="text-sm text-text-high">
                        <strong>Specific Action:</strong> Read meters and record monthly consumption from utility bills:
                        <ul className="mt-2 space-y-1 ml-4">
                          {meterInfo.map((meter, index) => (
                            <li key={index}>
                              • {meter.meter_id || meter.id} ({meter.type}) at {meter.location}
                            </li>
                          ))}
                        </ul>
                        
                        <div className="mt-3">
                          <strong>Files to Upload:</strong>
                          <ul className="mt-1 space-y-1 ml-4">
                            {meterInfo.filter(m => m.bills_required).map((meter, index) => (
                              <li key={index}>
                                • {meter.provider} utility bills for {meter.type} meter {meter.meter_id || meter.id}
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <div className="mt-3 text-xs text-amber-300">
                          <strong>Total:</strong> {meterInfo.filter(m => m.bills_required).length} monthly bills showing consumption data
                        </div>
                      </div>
                    </div>
                  )}
                  
                </Card>
              )}

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-3">
                {dataFields.length > 0 && (
                  <button
                    onClick={() => setActiveTab('data-entry')}
                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-text-high hover:bg-white/10 transition-colors flex items-center"
                  >
                    <i className="fa-solid fa-keyboard mr-2"></i>
                    Enter Data
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('evidence')}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-text-high hover:bg-white/10 transition-colors flex items-center"
                >
                  <i className="fa-solid fa-upload mr-2"></i>
                  Upload Evidence
                </button>
              </div>
            </div>
          )}

          {/* Data Entry Tab */}
          {activeTab === 'data-entry' && (
            <div className="space-y-6">
              <div className="text-lg font-medium text-text-high mb-4 flex items-center">
                <i className="fa-solid fa-chart-line mr-2 text-brand-green"></i>
                Data Entry
              </div>

              {/* No Data Entry Fields Warning */}
              {(() => {
                const text = `${task?.action_required || ''} ${task?.description || ''} ${task?.title || ''}`.toLowerCase();
                const taskNeedsMeters = text.includes('meter') || text.includes('electricity') || text.includes('water') || text.includes('gas') || 
                                       text.includes('consumption') || text.includes('read meters') || text.includes('utility bills');
                const hasDataFields = dataFields.filter(f => f.key !== 'notes').length > 0;
                const isExcludedTask = task?.title?.toLowerCase().includes('fuel') || 
                                      task?.title?.toLowerCase().includes('generator') || 
                                      task?.title?.toLowerCase().includes('lpg') || 
                                      task?.title?.toLowerCase().includes('cooling');
                
                return taskNeedsMeters && !hasDataFields && !isExcludedTask;
              })() && (
                <Card className="bg-amber-500/10 border-amber-500/20">
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fa-solid fa-triangle-exclamation text-2xl text-amber-500"></i>
                    </div>
                    <h3 className="text-lg font-medium text-text-high mb-2">No Data Entry Fields Available</h3>
                    <p className="text-sm text-text-muted mb-4">
                      This task requires meter readings, but no meters have been set up in your location settings.
                    </p>
                    <div className="p-4 bg-amber-500/5 rounded-lg border border-amber-500/10 text-left">
                      <div className="flex items-start space-x-2">
                        <i className="fa-solid fa-lightbulb text-amber-500 text-sm mt-0.5"></i>
                        <div className="text-sm text-text-high">
                          <strong>How to fix this:</strong>
                          <ol className="mt-2 space-y-1 ml-4 list-decimal">
                            <li>Go to the onboarding section</li>
                            <li>Navigate to "Location & Meter Setup"</li>
                            <li>Add the required meters for this task</li>
                            <li>Return here - data entry fields will appear automatically</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dataFields.map((field) => (
                  <Card 
                    key={field.key}
                    className={`bg-white/5 border-white/10 hover:border-brand-green/30 transition-colors ${
                      field.type === 'textarea' || field.type === 'warning' ? 'md:col-span-2' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className={`w-8 h-8 bg-${field.color}-500/20 rounded-lg flex items-center justify-center`}>
                          <i className={`fa-solid ${field.icon} text-${field.color}-400 text-sm`}></i>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-text-high">
                            {field.label}
                            {field.required && <span className="text-red-400 ml-1">*</span>}
                          </div>
                          {field.sublabel && (
                            <div className="text-xs text-text-muted font-medium">{field.sublabel}</div>
                          )}
                          {field.period && (
                            <div className="text-xs text-text-muted">{field.period}</div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {field.type === 'warning' ? (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                        <div className="text-amber-300 text-sm">
                          {field.warningMessage}
                        </div>
                        <div className="text-xs text-amber-400 mt-2">
                          💡 Add the required meters in your <span className="font-medium">Location Settings</span> to track this data.
                        </div>
                      </div>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        placeholder={field.placeholder}
                        value={dataEntries[field.key] || ''}
                        onChange={(e) => handleDataEntry(field.key, e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-text-high placeholder-text-muted focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-colors resize-none"
                        rows="3"
                      />
                    ) : (
                      <div className="relative">
                        <input
                          type={field.type}
                          placeholder={field.placeholder}
                          value={dataEntries[field.key] || ''}
                          onChange={(e) => handleDataEntry(field.key, e.target.value)}
                          onBlur={(e) => saveDataEntry(field.key, e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-text-high placeholder-text-muted focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-colors pr-12"
                        />
                        {field.unit && (
                          <span className="absolute right-3 top-2 text-text-muted text-sm">{field.unit}</span>
                        )}
                      </div>
                    )}
                    
                    {dataEntries[field.key] && (
                      <div className="mt-2 flex items-center text-xs text-brand-green">
                        <i className="fa-solid fa-check-circle mr-1"></i>
                        Data saved
                      </div>
                    )}
                  </Card>
                ))}
              </div>

              {/* Data Entry Progress */}
              <Card className="bg-white/5 border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-text-high">Data Entry Progress</span>
                  <span className="text-sm text-brand-green font-medium">
                    {calculateOverallProgress().dataProgress}%
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-2 rounded-full bg-gradient-to-r from-brand-green to-green-400 transition-all duration-500"
                    style={{ 
                      width: `${calculateOverallProgress().dataProgress}%` 
                    }}
                  />
                </div>
              </Card>
            </div>
          )}

          {/* Evidence Upload Tab */}
          {activeTab === 'evidence' && (
            <div className="space-y-6">
              <div className="text-lg font-medium text-text-high mb-4 flex items-center">
                <i className="fa-solid fa-folder-open mr-2 text-brand-blue"></i>
                Required Documents
                <span className="ml-2 bg-brand-blue/20 text-brand-blue px-2 py-1 rounded-full text-xs">
                  {requiredDocuments.filter(d => d.required).length} Required
                </span>
              </div>

              {/* Single Unified Upload Section - No Document Classification */}
              <Card className="bg-white/5 border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <i className="fa-solid fa-file text-brand-blue"></i>
                    <h4 className="text-sm font-medium text-text-high">
                      Supporting Documents
                      {requiredDocuments.filter(d => d.required).length > 0 && (
                        <span className="text-brand-blue ml-2">
                          ({requiredDocuments.filter(d => d.required).length} required)
                        </span>
                      )}
                    </h4>
                  </div>
                  <span className="bg-brand-blue/20 text-brand-blue px-2 py-1 rounded text-xs">
                    All file types accepted
                  </span>
                </div>
                
                <p className="text-sm text-text-muted mb-4">
                  Upload all required evidence and supporting documents here. You can upload multiple files at once.
                </p>

                {/* Single Unified Drag and Drop Zone */}
                <div
                  className={`relative border-2 border-dashed rounded-lg p-8 transition-all duration-200 text-center ${
                    dragActive
                      ? 'border-brand-green bg-brand-green/10'
                      : 'border-white/20 hover:border-brand-green/50 bg-white/5'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept="*"
                    multiple
                    onChange={(e) => handleFileSelect(e, 'supporting_documents')}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-brand-green/20 rounded-lg flex items-center justify-center mb-3">
                      <i className="fa-solid fa-cloud-upload-alt text-brand-green text-xl"></i>
                    </div>
                    <p className="text-text-high font-medium mb-1">Drop files here or click to browse</p>
                    <p className="text-text-muted text-xs">
                      PDF, DOC, images, and all other file types • Max 10MB per file
                    </p>
                  </div>
                </div>

                {/* All Uploaded Files - No Classification */}
                {evidence.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h5 className="text-xs font-medium text-text-high flex items-center">
                      <i className="fa-solid fa-paperclip mr-2"></i>
                      Uploaded Files ({evidence.length})
                    </h5>
                    {evidence.map((item) => (
                      <div key={item.id} className="flex items-center justify-between bg-brand-green/10 border border-brand-green/20 rounded-lg p-3">
                        <div className="flex items-center space-x-3">
                          <i className="fa-solid fa-file text-brand-green"></i>
                          <div>
                            <p className="text-sm text-text-high font-medium">{item.title || item.original_filename}</p>
                            <p className="text-xs text-text-muted">
                              {item.file_size ? `${(item.file_size / 1024 / 1024).toFixed(2)} MB` : 'Uploaded'} • 
                              {item.uploaded_at ? format(new Date(item.uploaded_at), 'MMM dd, HH:mm') : 'Just now'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <a
                            href={`/api${item.file}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-blue hover:text-brand-blue-light text-xs px-2 py-1 bg-brand-blue/20 rounded"
                          >
                            <i className="fa-solid fa-external-link mr-1"></i>
                            View
                          </a>
                          <button
                            onClick={() => handleRemoveEvidence(item.id)}
                            className="w-8 h-8 rounded-lg bg-red-400/20 text-red-400 hover:bg-red-400/30 transition-colors flex items-center justify-center"
                          >
                            <i className="fa-solid fa-times text-sm"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>


              {/* Upload Progress */}
              <Card className="bg-white/5 border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-text-high">Upload Progress</span>
                  <span className="text-sm text-brand-green font-medium">{calculateOverallProgress().fileProgress}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-2 rounded-full bg-gradient-to-r from-brand-green to-green-400 transition-all duration-500"
                    style={{ width: `${calculateOverallProgress().fileProgress}%` }}
                  />
                </div>
                <p className="text-xs text-text-muted mt-2">
                  {evidence.length} files uploaded {requiredDocuments.filter(d => d.required).length > 0 ? `(${requiredDocuments.filter(d => d.required).length} required)` : ''}
                </p>
              </Card>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="text-lg font-medium text-text-high mb-4 flex items-center">
                <i className="fa-solid fa-clock-rotate-left mr-2 text-brand-blue"></i>
                Activity History
                <span className="ml-2 bg-brand-blue/20 text-brand-blue px-2 py-1 rounded-full text-xs">
                  {history.length} activities
                </span>
              </div>

              {history.length > 0 ? (
                <div className="space-y-4">
                  {history.map((entry, index) => (
                    <Card key={entry.id} className="bg-white/5 border-white/10">
                      <div className="flex items-start space-x-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          entry.type === 'upload' ? 'bg-brand-green/20 text-brand-green' :
                          entry.type === 'data_entry' ? 'bg-brand-blue/20 text-brand-blue' :
                          entry.type === 'status_change' ? 'bg-amber-500/20 text-amber-500' :
                          entry.type === 'task_created' ? 'bg-purple-500/20 text-purple-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          <i className={`fa-solid ${
                            entry.type === 'upload' ? (entry.action.includes('removed') ? 'fa-trash' : 'fa-upload') :
                            entry.type === 'data_entry' ? 'fa-keyboard' :
                            entry.type === 'status_change' ? 'fa-arrow-right' :
                            entry.type === 'task_created' ? 'fa-plus' :
                            'fa-circle'
                          } text-sm`}></i>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-text-high">
                              {entry.action}
                            </p>
                            <span className="text-xs text-text-muted">
                              {format(new Date(entry.timestamp), 'MMM dd, HH:mm')}
                            </span>
                          </div>
                          
                          {entry.details && (
                            <div className="mt-1 text-xs text-text-muted space-y-1">
                              {entry.type === 'upload' && (
                                <>
                                  <div>File: {entry.details.filename}</div>
                                  {entry.details.fileSize && (
                                    <div>Size: {(entry.details.fileSize / 1024 / 1024).toFixed(2)} MB</div>
                                  )}
                                  {entry.details.progressAfter !== undefined && (
                                    <div>Progress: {entry.details.progressBefore || 0}% → {entry.details.progressAfter}%</div>
                                  )}
                                </>
                              )}
                              
                              {entry.type === 'data_entry' && (
                                <>
                                  <div>Field: {entry.details.field}</div>
                                  <div>Value: {entry.details.value}</div>
                                  {entry.details.previousValue !== 'Empty' && (
                                    <div>Previous: {entry.details.previousValue}</div>
                                  )}
                                </>
                              )}
                              
                              {entry.type === 'task_created' && (
                                <div>Task: {entry.details.title}</div>
                              )}
                            </div>
                          )}
                          
                          <div className="mt-1 text-xs text-text-muted">
                            by {entry.user}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fa-solid fa-clock-rotate-left text-2xl text-text-muted"></i>
                  </div>
                  <h3 className="text-lg font-medium text-text-high mb-2">No Activity Yet</h3>
                  <p className="text-sm text-text-muted">Start uploading files or entering data to see activity history</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-white/10">
          <div className="text-sm text-text-muted">
            {evidence.length} files uploaded {requiredDocuments.filter(d => d.required).length > 0 ? `(${requiredDocuments.filter(d => d.required).length} required)` : ''} • Auto-save enabled
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" onClick={onClose}>
              Save & Close
            </Button>
            <Button 
              variant="primary" 
              disabled={taskProgress < 100}
              onClick={() => {
                if (taskProgress >= 100) {
                  // Add to history
                  addHistoryEntry('status_change', 'Task completed by user', {
                    fromStatus: task.status,
                    toStatus: 'completed',
                    progress: taskProgress,
                    completionMethod: 'manual'
                  });
                  
                  toast.success('Task completed successfully!');
                  onClose();
                }
              }}
            >
              <i className="fa-solid fa-check mr-2"></i>
              Complete Task
            </Button>
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      <AssignmentModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        onAssign={handleAssignUser}
        users={availableUsers}
        currentAssignedId={task?.assigned_to}
        loading={loadingUsers}
      />
    </Modal>
  );
};

// Assignment Modal Component
const AssignmentModal = ({ isOpen, onClose, onAssign, users, currentAssignedId, loading = false }) => {
  const [selectedUserId, setSelectedUserId] = useState(currentAssignedId || '');
  const [searchTerm, setSearchTerm] = useState('');

  React.useEffect(() => {
    setSelectedUserId(currentAssignedId || '');
  }, [currentAssignedId]);

  const filteredUsers = (Array.isArray(users) ? users : []).filter(user =>
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAssign = () => {
    if (selectedUserId) {
      const userId = isNaN(selectedUserId) ? selectedUserId : parseInt(selectedUserId);
      onAssign(userId);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Task to Team Member"
      size="medium"
    >
      <div className="space-y-4">
        <Input
          placeholder="Search team members..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />

        <div className="max-h-64 overflow-y-auto space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="medium" />
              <span className="ml-3 text-text-muted">Loading team members...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <i className="fa-solid fa-users text-2xl text-text-muted mb-2"></i>
              <p className="text-text-muted">No team members found</p>
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.id}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedUserId === user.id.toString()
                    ? 'border-brand-green bg-brand-green/10'
                    : 'border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10'
                }`}
                onClick={() => {
                  const userIdStr = user.id.toString();
                  setSelectedUserId(selectedUserId === userIdStr ? '' : userIdStr);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <UserAvatar 
                      fullName={user.full_name}
                      email={user.email}
                      size="sm"
                    />
                    <div>
                      <h4 className="text-sm font-medium text-text-high">{user.full_name}</h4>
                      <p className="text-xs text-text-muted">{user.email}</p>
                      {user.department && (
                        <p className="text-xs text-text-muted">{user.department}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-brand-blue/20 text-brand-blue">
                      {user.role || 'Team Member'}
                    </span>
                    {selectedUserId === user.id.toString() && (
                      <i className="fa-solid fa-check text-brand-green"></i>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <span className="text-sm text-text-muted">
            {filteredUsers.length} team member{filteredUsers.length !== 1 ? 's' : ''} available
          </span>
          <div className="flex items-center space-x-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAssign}
              disabled={!selectedUserId}
            >
              <i className="fa-solid fa-user-plus mr-2"></i>
              Assign Task
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default TaskDetail;