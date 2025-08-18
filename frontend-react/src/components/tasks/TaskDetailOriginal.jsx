import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useQueryClient } from 'react-query';
import { format } from 'date-fns';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Modal from '../ui/Modal';
import LoadingSpinner from '../ui/LoadingSpinner';
import UserAvatar from '../ui/UserAvatar';
import { esgAPI } from '../../services/api';

const TaskDetail = ({ task, isOpen, onClose, onUpdate }) => {
  const queryClient = useQueryClient();
  const [evidence, setEvidence] = useState([]);
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  // Load real team members from API instead of hardcoded data
  useEffect(() => {
    const loadTeamMembers = async () => {
      if (showAssignModal && availableUsers.length === 0) {
        setLoadingUsers(true);
        try {
          const response = await esgAPI.getTeamMembers();
          console.log('📋 API response for team members:', response);
          
          // Handle different response structures
          let users = [];
          if (Array.isArray(response)) {
            users = response;
          } else if (response && Array.isArray(response.data)) {
            users = response.data;
          } else if (response && Array.isArray(response.results)) {
            users = response.results;
          } else if (response && Array.isArray(response.members)) {
            users = response.members;
          } else {
            console.warn('Unexpected API response structure:', response);
            users = [];
          }
          
          console.log('📋 Processed team members for assignment:', users);
          setAvailableUsers(users);
        } catch (error) {
          console.error('❌ Error loading team members:', error);
          
          // Handle network errors gracefully
          if (error.message && error.message.includes('Network connection lost')) {
            toast.error('Network connection lost. Team member assignment unavailable.');
          } else {
            toast.error('Failed to load team members');
          }
          setAvailableUsers([]); // Fallback to empty array
        } finally {
          setLoadingUsers(false);
        }
      }
    };

    loadTeamMembers();
  }, [showAssignModal, availableUsers.length]);

  useEffect(() => {
    if (task) {
      // Load evidence from API data (task.attachments)
      const taskAttachments = task.attachments || [];
      console.log('📎 Loading task attachments from API:', taskAttachments.length);
      
      // Filter out any invalid attachments to prevent 404s
      const validAttachments = taskAttachments.filter(att => att && att.id);
      setEvidence(validAttachments);
      setTaskProgress(task.progress_percentage || 0);
    }
  }, [task]);

  const handleAssignUser = async (userId) => {
    const user = availableUsers.find(u => u.id === userId);
    if (!user) return;

    try {
      // Update task via API
      const updatedTask = await esgAPI.updateTask(task.id, {
        assigned_to: userId,
        assigned_at: new Date().toISOString()
      });

      if (onUpdate) {
        onUpdate({
          ...updatedTask,
          assigned_user: user // Add user details for UI
        });
      }

      setShowAssignModal(false);
      toast.success(`Task assigned to ${user.full_name}`);
    } catch (error) {
      console.error('❌ Error assigning task:', error);
      toast.error('Failed to assign task');
    }
  };

  const handleUnassignUser = async () => {
    try {
      // Update task via API
      const updatedTask = await esgAPI.updateTask(task.id, {
        assigned_to: null,
        assigned_at: null
      });

      if (onUpdate) {
        onUpdate({
          ...updatedTask,
          assigned_user: null
        });
      }

      toast.success('User unassigned from task');
    } catch (error) {
      console.error('❌ Error unassigning task:', error);
      toast.error('Failed to unassign task');
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'high': 'text-red-400',
      'medium': 'text-yellow-400',
      'low': 'text-green-400'
    };
    return colors[priority] || 'text-gray-400';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'environmental': 'fa-solid fa-leaf text-green-400',
      'social': 'fa-solid fa-users text-blue-400',
      'governance': 'fa-solid fa-shield-halved text-purple-400',
      'general': 'fa-solid fa-tasks text-gray-400'
    };
    return icons[category] || 'fa-solid fa-task text-gray-400';
  };

  const getEvidenceTypeInfo = (dataSource, taskTitle = '') => {
    const dataSourceLower = dataSource.toLowerCase();
    const titleLower = taskTitle.toLowerCase();
    const combined = `${dataSourceLower} ${titleLower}`;
    
    // Check for utility bills FIRST (before meter detection)
    if (combined.includes('bills') || combined.includes('invoices')) {
      return {
        type: 'file',
        title: 'Upload Bills/Invoices',
        description: 'Upload utility bills, invoices, or receipts as evidence',
        expectedCount: 3,
        fileTypes: '.pdf,.png,.jpg,.jpeg',
        maxFileSize: '10MB',
        icon: 'fa-file-invoice',
        color: 'blue'
      };
    }
    
    // Meter-related tasks should support data entry (but NOT if it's mainly about IAQ/air quality)
    if ((combined.includes('meter') || combined.includes('dewa') || combined.includes('addc')) && 
        (combined.includes('track') || combined.includes('monitor') || combined.includes('consumption')) &&
        !combined.includes('air quality') && !combined.includes('iaq') && !combined.includes('indoor air')) {
      return {
        type: 'mixed', // Support both data and files
        title: 'Enter Meter Reading or Upload Bill',
        description: 'Enter current meter reading or upload utility bill as evidence',
        expectedCount: 1,
        dataType: 'number',
        fileTypes: '.pdf,.png,.jpg,.jpeg',
        supportsData: true,
        supportsFiles: true,
        maxFileSize: '5MB',
        icon: 'fa-gauge',
        color: 'green',
        units: ['kWh', 'm³', 'gallons', 'liters'],
        placeholder: 'Enter reading (e.g., 1250.5)'
      };
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
      
      return {
        type: 'mixed',
        title: 'Enter Data or Upload File',
        description: 'Enter numerical data or measurements, or upload supporting evidence',
        expectedCount: 1,
        dataType: 'number',
        fileTypes: '.pdf,.png,.jpg,.jpeg',
        supportsData: true,
        supportsFiles: true,
        maxFileSize: '5MB',
        icon: 'fa-chart-line',
        color: 'yellow',
        units: ['%', 'kWh', 'm³', 'tons', '°C', 'ppm'],
        placeholder: 'Enter measurement value'
      };
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
      
      if (combined.includes('policy') || combined.includes('document')) {
        return {
          type: 'file',
          title: 'Upload Policy Document',
          description: 'Upload the policy document or certificate',
          expectedCount: 1,
          fileTypes: '.pdf,.doc,.docx',
          maxFileSize: '10MB',
          icon: 'fa-file-contract',
          color: 'purple'
        };
      } else if (combined.includes('photo') || combined.includes('picture')) {
        // Check if it's mixed content (photos + documents)
        if (combined.includes('agreement') || combined.includes('contract') || combined.includes('document')) {
          return {
            type: 'file',
            title: 'Upload Photos & Documents',
            description: 'Upload photos and supporting documents as evidence',
            expectedCount: 2,
            fileTypes: '.pdf,.doc,.docx,.png,.jpg,.jpeg',
            maxFileSize: '15MB',
            icon: 'fa-images',
            color: 'green'
          };
        } else {
          return {
            type: 'file',
            title: 'Upload Photos',
            description: 'Upload photos as evidence',
            expectedCount: 2,
            fileTypes: '.png,.jpg,.jpeg',
            maxFileSize: '10MB',
            icon: 'fa-camera',
            color: 'blue'
          };
        }
      } else {
        return {
          type: 'file',
          title: 'Upload Evidence',
          description: 'Upload relevant documentation or evidence',
          expectedCount: 1,
          fileTypes: '.pdf,.doc,.docx,.png,.jpg,.jpeg',
          maxFileSize: '10MB',
          icon: 'fa-paperclip',
          color: 'gray'
        };
      }
    }
    
    // Default: if task asks about having/doing something, it likely needs file evidence
    return {
      type: 'file',
      title: 'Upload Evidence',
      description: 'Upload relevant documentation or evidence',
      expectedCount: 1,
      fileTypes: '.pdf,.doc,.docx,.png,.jpg,.jpeg',
      maxFileSize: '10MB',
      icon: 'fa-file',
      color: 'gray'
    };
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file) => {
    const evidenceInfo = getEvidenceTypeInfo(task.action_required || '', task.title || '');
    
    // Check file size
    const maxSize = evidenceInfo.maxFileSize || '10MB';
    const maxBytes = parseFloat(maxSize) * 1024 * 1024;
    
    if (file.size > maxBytes) {
      toast.error(`File size exceeds ${maxSize} limit`);
      return;
    }
    
    // Check file type
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    const allowedTypes = evidenceInfo.fileTypes.split(',').map(type => type.trim());
    
    if (!allowedTypes.includes(fileExtension)) {
      toast.error(`File type ${fileExtension} not allowed. Accepted types: ${evidenceInfo.fileTypes}`);
      return;
    }
    
    setNewEvidence(prev => ({ 
      ...prev, 
      file, 
      title: file.name.replace(/\.[^/.]+$/, "") // Remove extension from title
    }));
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewFile(e.target.result);
      reader.readAsDataURL(file);
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
        // Upload file to backend
        uploadedAttachment = await esgAPI.uploadTaskAttachment(task.id, {
          file: newEvidence.file,
          title: newEvidence.title,
          description: newEvidence.description,
          attachment_type: 'evidence'
        });
      } else {
        // For data entries, create a text attachment
        const dataValue = newEvidence.unit ? `${newEvidence.value} ${newEvidence.unit}` : newEvidence.value;
        const textFile = new Blob([dataValue], { type: 'text/plain' });
        uploadedAttachment = await esgAPI.uploadTaskAttachment(task.id, {
          file: new File([textFile], `${newEvidence.title}.txt`, { type: 'text/plain' }),
          title: newEvidence.title,
          description: `Data entry: ${dataValue}\n\n${newEvidence.description}`,
          attachment_type: 'data_evidence'
        });
      }

      // Update local evidence state
      const updatedEvidence = [...evidence, uploadedAttachment];
      setEvidence(updatedEvidence);

      // Calculate progress and update task
      const evidenceInfo = getEvidenceTypeInfo(task.action_required || '', task.title || '');
      const progressPercentage = Math.min((updatedEvidence.length / evidenceInfo.expectedCount) * 100, 100);
      setTaskProgress(progressPercentage);

      // Update task progress via API
      await esgAPI.updateTask(task.id, {
        progress_percentage: progressPercentage,
        status: progressPercentage >= 100 ? 'completed' : (progressPercentage > 0 ? 'in_progress' : task.status)
      });

      // Reset form
      setNewEvidence({
        type: 'file',
        title: '',
        description: '',
        value: '',
        file: null,
        unit: ''
      });
      setPreviewFile(null);

      setIsSubmitting(false);
      toast.success('Evidence uploaded successfully!');

      // Invalidate progress tracker query to refresh progress
      queryClient.invalidateQueries('progress-tracker');
      queryClient.invalidateQueries('tasks');

      // Update parent component
      if (onUpdate) {
        onUpdate({
          ...task,
          attachments: updatedEvidence,
          progress_percentage: progressPercentage,
          status: progressPercentage >= 100 ? 'completed' : (progressPercentage > 0 ? 'in_progress' : task.status)
        });
      }

    } catch (error) {
      console.error('Error adding evidence:', error);
      setIsSubmitting(false);
      
      // Handle specific error types
      if (error.message && error.message.includes('Network connection lost')) {
        toast.error('Network connection lost. Please check your internet connection and try again.');
      } else if (error.response?.status === 404) {
        toast.error('Task not found. Please refresh the page and try again.');
      } else if (error.response?.status === 413) {
        toast.error('File too large. Please select a smaller file.');
      } else {
        const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Failed to upload evidence';
        toast.error(errorMsg);
      }
    }
  };

  const handleRemoveEvidence = async (evidenceId) => {
    try {
      // Delete attachment via API
      await esgAPI.deleteTaskAttachment(task.id, evidenceId);

      // Update local state
      const updatedEvidence = evidence.filter(e => e.id !== evidenceId);
      setEvidence(updatedEvidence);

      // Update progress
      const evidenceInfo = getEvidenceTypeInfo(task.action_required || '', task.title || '');
      const progressPercentage = Math.min((updatedEvidence.length / evidenceInfo.expectedCount) * 100, 100);
      setTaskProgress(progressPercentage);

      // Update task progress via API
      await esgAPI.updateTask(task.id, {
        progress_percentage: progressPercentage,
        status: progressPercentage >= 100 ? 'completed' : (progressPercentage > 0 ? 'in_progress' : 'todo')
      });

      if (onUpdate) {
        onUpdate({
          ...task,
          attachments: updatedEvidence,
          progress_percentage: progressPercentage,
          status: progressPercentage >= 100 ? 'completed' : (progressPercentage > 0 ? 'in_progress' : 'todo')
        });
      }

      // Invalidate progress tracker query to refresh progress
      queryClient.invalidateQueries('progress-tracker');
      queryClient.invalidateQueries('tasks');

      toast.success('Evidence removed');
    } catch (error) {
      console.error('❌ Error removing evidence:', error);
      
      // Handle specific error types
      if (error.message && error.message.includes('Network connection lost')) {
        toast.error('Network connection lost. Please check your internet connection and try again.');
      } else if (error.response?.status === 404) {
        toast.error('Evidence not found. It may have been already deleted.');
      } else {
        const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Failed to remove evidence';
        toast.error(errorMsg);
      }
    }
  };

  const handleDownloadEvidence = (evidenceItem) => {
    if (evidenceItem.fileData) {
      const link = document.createElement('a');
      link.href = evidenceItem.fileData;
      link.download = evidenceItem.fileName || 'evidence';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (!task) return null;

  const evidenceInfo = getEvidenceTypeInfo(task.action_required || '', task.title || '');

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
              <i className={getCategoryIcon(task.category)}></i>
              <div>
                <h3 className="text-lg font-semibold text-text-high">{task.title}</h3>
                <div className="flex items-center space-x-4 mt-1">
                  <span className={`text-sm font-medium ${getPriorityColor(task.priority)}`}>
                    {task.priority.toUpperCase()} Priority
                  </span>
                  {task.due_date && (
                    <span className="text-sm text-text-muted">
                      Due: {format(new Date(task.due_date), 'MMM dd, yyyy')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end space-y-2">
              {task.sector && (
                <div className="flex flex-col items-end space-y-1">
                  <span className="bg-brand-green/20 text-brand-green px-3 py-1 rounded-full text-sm">
                    ESG {task.sector}
                  </span>
                  <span className="text-xs text-brand-blue bg-brand-blue/10 px-2 py-1 rounded">
                    🔒 Read-only
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Assignment Section */}
          <div className="bg-white/5 rounded-lg p-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <i className="fa-solid fa-user-tag text-brand-blue"></i>
                <div>
                  <h4 className="text-sm font-medium text-text-high">Task Assignment</h4>
                  {task.assigned_user ? (
                    <div className="flex items-center space-x-2 mt-1">
                      <UserAvatar 
                        fullName={task.assigned_user.full_name}
                        email={task.assigned_user.email}
                        size="xs"
                      />
                      <div>
                        <span className="text-sm text-text-high font-medium">{task.assigned_user.full_name}</span>
                        <span className="text-xs text-text-muted ml-2">({task.assigned_user.department})</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-text-muted">No user assigned</span>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {task.assigned_user ? (
                  <>
                    <Button
                      size="small"
                      variant="outline"
                      onClick={() => setShowAssignModal(true)}
                    >
                      <i className="fa-solid fa-user-pen mr-1"></i>
                      Reassign
                    </Button>
                    <Button
                      size="small"
                      variant="outline"
                      onClick={handleUnassignUser}
                      className="text-red-400 border-red-400 hover:bg-red-400/10"
                    >
                      <i className="fa-solid fa-user-minus mr-1"></i>
                      Unassign
                    </Button>
                  </>
                ) : (
                  <Button
                    size="small"
                    variant="primary"
                    onClick={() => setShowAssignModal(true)}
                  >
                    <i className="fa-solid fa-user-plus mr-1"></i>
                    Assign User
                  </Button>
                )}
              </div>
            </div>
            {task.assigned_at && (
              <div className="text-xs text-text-muted mt-2">
                Assigned on {format(new Date(task.assigned_at), 'MMM dd, yyyy HH:mm')}
              </div>
            )}
          </div>

          {task.description && (
            <p className="text-text-muted mb-3">{task.description}</p>
          )}

          {task.compliance_context && (
            <div className="bg-brand-blue/10 border border-brand-blue/20 rounded-lg p-3">
              <h4 className="text-sm font-medium text-brand-blue mb-1">Compliance Context</h4>
              <p className="text-sm text-text-muted">{task.compliance_context}</p>
            </div>
          )}

          {task.sector && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <i className="fa-solid fa-lock text-amber-500 mt-0.5"></i>
                <div>
                  <h4 className="text-sm font-medium text-amber-500 mb-1">ESG Compliance Task</h4>
                  <p className="text-xs text-text-muted">
                    This task was automatically generated from your ESG assessment and cannot be edited to maintain audit integrity. 
                    You can only upload evidence and track progress.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Progress Bar */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-text-high font-medium">Task Progress</span>
            <div className="flex items-center space-x-2">
              <span className="text-text-muted">{Math.round(taskProgress)}%</span>
              {taskProgress >= 100 && (
                <div className="flex items-center space-x-1 text-brand-green">
                  <i className="fa-solid fa-check-circle"></i>
                  <span className="text-xs font-medium">Complete</span>
                </div>
              )}
            </div>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
            <div 
              className={`h-3 rounded-full transition-all duration-500 ${
                taskProgress >= 100 
                  ? 'bg-gradient-to-r from-brand-green to-green-400' 
                  : 'bg-brand-green'
              }`}
              style={{ width: `${taskProgress}%` }}
            />
          </div>
          {taskProgress > 0 && taskProgress < 100 && (
            <p className="text-xs text-text-muted mt-1">
              {evidenceInfo.expectedCount - evidence.length} more evidence item{evidenceInfo.expectedCount - evidence.length !== 1 ? 's' : ''} needed
            </p>
          )}
        </div>

        {/* Evidence Requirements */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-text-high font-medium">Required Evidence</h4>
            <span className="text-sm text-text-muted">
              {evidence.length} of {evidenceInfo.expectedCount} items
            </span>
          </div>

          <div className="bg-white/5 rounded-lg p-4 mb-4">
            <div className="flex items-start space-x-3">
              <i className="fa-solid fa-info-circle text-brand-blue mt-1"></i>
              <div>
                <h5 className="text-sm font-medium text-text-high mb-1">{evidenceInfo.title}</h5>
                <p className="text-xs text-text-muted mb-2">{evidenceInfo.description}</p>
                <p className="text-xs text-text-muted">
                  <strong>Data Source:</strong> {task.action_required}
                </p>
              </div>
            </div>
          </div>

          {/* Enhanced Task Type Guidance */}
          <div className={`rounded-lg p-4 mb-4 border ${
            evidenceInfo.type === 'data' 
              ? 'bg-green-500/10 border-green-500/30'
              : evidenceInfo.type === 'file'
              ? 'bg-blue-500/10 border-blue-500/30'
              : 'bg-yellow-500/10 border-yellow-500/30'
          }`}>
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                evidenceInfo.type === 'data'
                  ? 'bg-green-500/20'
                  : evidenceInfo.type === 'file'
                  ? 'bg-blue-500/20'
                  : 'bg-yellow-500/20'
              }`}>
                <i className={`${evidenceInfo.icon || 'fa-solid fa-file'} ${
                  evidenceInfo.type === 'data'
                    ? 'text-green-400'
                    : evidenceInfo.type === 'file'
                    ? 'text-blue-400'
                    : 'text-yellow-400'
                }`}></i>
              </div>
              <div className="flex-1">
                <h4 className={`font-semibold text-sm ${
                  evidenceInfo.type === 'data'
                    ? 'text-green-400'
                    : evidenceInfo.type === 'file'
                    ? 'text-blue-400'
                    : 'text-yellow-400'
                }`}>
                  {evidenceInfo.type === 'data' && 'DATA ENTRY REQUIRED'}
                  {evidenceInfo.type === 'file' && 'FILE UPLOAD REQUIRED'}
                  {evidenceInfo.type === 'mixed' && 'FLEXIBLE EVIDENCE - YOUR CHOICE'}
                </h4>
                <p className="text-xs text-text-muted mt-1">
                  {evidenceInfo.type === 'data' && 'This task requires you to enter numerical data or measurements. No file upload needed.'}
                  {evidenceInfo.type === 'file' && 'This task requires you to upload documents, photos, or files as evidence. No data entry needed.'}
                  {evidenceInfo.type === 'mixed' && 'You can choose to either enter meter readings/data OR upload bills/documents as evidence.'}
                </p>
                
                {/* Additional guidance based on task content */}
                {evidenceInfo.type === 'data' && (
                  <div className="mt-2 flex items-center space-x-4 text-xs">
                    <span className="bg-green-500/20 text-green-300 px-2 py-1 rounded">
                      <i className="fa-solid fa-calculator mr-1"></i>
                      Enter Numbers
                    </span>
                    {evidenceInfo.dataType === 'number' && (
                      <span className="text-green-300">
                        Expected: Numerical values (e.g., 1250, 45.6, 87%)
                      </span>
                    )}
                  </div>
                )}
                
                {evidenceInfo.type === 'file' && (
                  <div className="mt-2 flex items-center space-x-4 text-xs">
                    <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                      <i className="fa-solid fa-paperclip mr-1"></i>
                      Upload Files
                    </span>
                    {evidenceInfo.fileTypes && (
                      <span className="text-blue-300">
                        Accepted: {evidenceInfo.fileTypes}
                      </span>
                    )}
                  </div>
                )}
                
                {evidenceInfo.type === 'mixed' && (
                  <div className="mt-2 flex items-center space-x-4 text-xs">
                    <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded">
                      <i className="fa-solid fa-keyboard mr-1"></i>
                      Data Entry
                    </span>
                    <span className="text-yellow-300">OR</span>
                    <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded">
                      <i className="fa-solid fa-upload mr-1"></i>
                      File Upload
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Add Evidence Form */}
          <div className="space-y-4 mb-6">
            {/* Show buttons only for relevant evidence types */}
            {evidenceInfo.type === 'mixed' ? (
              // Show both buttons for mixed type
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={() => setNewEvidence(prev => ({ ...prev, type: 'file' }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    newEvidence.type === 'file'
                      ? 'bg-brand-green text-white'
                      : 'bg-white/10 text-text-muted hover:bg-white/20'
                  }`}
                >
                  <i className="fa-solid fa-upload mr-2"></i>
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setNewEvidence(prev => ({ ...prev, type: 'data' }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    newEvidence.type === 'data'
                      ? 'bg-brand-green text-white'
                      : 'bg-white/10 text-text-muted hover:bg-white/20'
                  }`}
                >
                  <i className="fa-solid fa-keyboard mr-2"></i>
                  Enter Data
                </button>
              </div>
            ) : evidenceInfo.type === 'file' ? (
              // Show only upload button for file tasks
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setNewEvidence(prev => ({ ...prev, type: 'file' }))}
                  className="px-6 py-3 bg-brand-blue text-white rounded-lg font-medium transition-colors hover:bg-brand-blue/90"
                >
                  <i className="fa-solid fa-upload mr-2"></i>
                  Upload File
                </button>
              </div>
            ) : (
              // Show only data entry button for data tasks
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setNewEvidence(prev => ({ ...prev, type: 'data' }))}
                  className="px-6 py-3 bg-brand-green text-white rounded-lg font-medium transition-colors hover:bg-brand-green/90"
                >
                  <i className="fa-solid fa-keyboard mr-2"></i>
                  Enter Data
                </button>
              </div>
            )}

            {newEvidence.type === 'file' ? (
              <div className="space-y-4">
                {/* Enhanced Drag and Drop File Upload */}
                <div>
                  <label className="block text-text-high font-medium mb-2">
                    Upload File
                  </label>
                  <div
                    className={`relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 ${
                      dragActive
                        ? 'border-brand-green bg-brand-green/10'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <input
                      type="file"
                      accept={evidenceInfo.fileTypes}
                      onChange={handleFileSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="text-center">
                      {newEvidence.file ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-center">
                            <i className={`${evidenceInfo.icon || 'fa-solid fa-file'} text-3xl text-brand-green`}></i>
                          </div>
                          <div>
                            <p className="text-text-high font-medium">{newEvidence.file.name}</p>
                            <p className="text-text-muted text-sm">
                              {(newEvidence.file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          {previewFile && (
                            <div className="mt-3">
                              <img 
                                src={previewFile} 
                                alt="Preview" 
                                className="max-w-32 max-h-32 mx-auto rounded-lg object-cover"
                              />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setNewEvidence(prev => ({ ...prev, file: null, title: '' }));
                              setPreviewFile(null);
                            }}
                            className="text-red-400 hover:text-red-300 text-sm transition-colors"
                          >
                            <i className="fa-solid fa-trash mr-1"></i>
                            Remove file
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-center">
                            <i className="fa-solid fa-cloud-upload-alt text-3xl text-white/40"></i>
                          </div>
                          <div>
                            <p className="text-text-high font-medium">Drop files here or click to browse</p>
                            <p className="text-text-muted text-sm">
                              Supports: {evidenceInfo.fileTypes} • Max size: {evidenceInfo.maxFileSize}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <Input
                  label="Title"
                  placeholder="Brief description of the file"
                  value={newEvidence.title}
                  onChange={(e) => setNewEvidence(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-text-high font-medium mb-2">
                      Data Value
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type={evidenceInfo.dataType === 'number' ? 'number' : 'text'}
                        placeholder={evidenceInfo.placeholder || "Enter the measured value"}
                        value={newEvidence.value}
                        onChange={(e) => setNewEvidence(prev => ({ ...prev, value: e.target.value }))}
                        className="flex-1 px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-text-high placeholder-text-muted focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-colors"
                      />
                      {evidenceInfo.units && (
                        <select
                          value={newEvidence.unit}
                          onChange={(e) => setNewEvidence(prev => ({ ...prev, unit: e.target.value }))}
                          className="px-3 py-3 bg-white/5 border border-white/20 rounded-lg text-text-high focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-colors"
                        >
                          <option value="">Unit</option>
                          {evidenceInfo.units.map(unit => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    {evidenceInfo.dataType === 'number' && (
                      <p className="text-xs text-text-muted mt-1">
                        Enter numerical values only (decimals allowed)
                      </p>
                    )}
                  </div>
                  
                  <Input
                    label="Title"
                    placeholder="Description of this data point"
                    value={newEvidence.title}
                    onChange={(e) => setNewEvidence(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-text-high font-medium mb-2">
                Notes (Optional)
              </label>
              <textarea
                placeholder="Additional notes about this evidence"
                rows="2"
                value={newEvidence.description}
                onChange={(e) => setNewEvidence(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-text-high placeholder-text-muted focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-colors resize-none"
              />
            </div>

            <Button
              onClick={handleAddEvidence}
              loading={isSubmitting}
              className="w-full"
            >
              <i className="fa-solid fa-plus mr-2"></i>
              Add Evidence
            </Button>
          </div>

          {/* Enhanced Evidence List */}
          {evidence.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-text-high font-medium">Uploaded Evidence</h5>
                <span className="text-xs text-text-muted">
                  {evidence.length} / {evidenceInfo.expectedCount} items
                </span>
              </div>
              {evidence.map((item, index) => (
                <div key={item.id} className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-white/20 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-brand-green/20 flex items-center justify-center">
                        <i className={`fa-solid ${
                          item.attachment_type === 'data_evidence' ? 'fa-chart-line' : 'fa-file'
                        } text-brand-green text-sm`}></i>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h6 className="text-text-high font-medium text-sm">{item.title}</h6>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            item.attachment_type === 'data_evidence' 
                              ? 'bg-green-500/20 text-green-300'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}>
                            {item.attachment_type === 'data_evidence' ? 'Data' : 'File'}
                          </span>
                        </div>
                        
                        {item.description && (
                          <p className="text-text-muted text-xs mt-1">{item.description}</p>
                        )}
                        
                        {item.attachment_type === 'data_evidence' && item.description && (
                          <div className="mt-2 p-2 bg-green-500/10 rounded border border-green-500/20">
                            <p className="text-green-300 text-sm font-medium">
                              {item.description.split('\\n')[0].replace('Data entry: ', '')}
                            </p>
                          </div>
                        )}
                        
                        {item.file && (
                          <div className="flex items-center space-x-4 mt-2 text-xs text-text-muted">
                            <span>
                              <i className="fa-solid fa-file mr-1"></i>
                              {item.file}
                            </span>
                            {item.file_size && (
                              <span>
                                <i className="fa-solid fa-weight mr-1"></i>
                                {(item.file_size / 1024 / 1024).toFixed(2)} MB
                              </span>
                            )}
                          </div>
                        )}
                        
                        <p className="text-text-muted text-xs mt-2">
                          <i className="fa-solid fa-clock mr-1"></i>
                          Added: {format(new Date(item.uploaded_at || new Date()), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {item.file && (
                        <button
                          onClick={() => handleDownloadEvidence(item)}
                          className="w-8 h-8 rounded-lg bg-brand-blue/20 text-brand-blue hover:bg-brand-blue/30 transition-colors flex items-center justify-center"
                          title="Download"
                        >
                          <i className="fa-solid fa-download text-sm"></i>
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveEvidence(item.id)}
                        className="w-8 h-8 rounded-lg bg-red-400/20 text-red-400 hover:bg-red-400/30 transition-colors flex items-center justify-center"
                        title="Remove"
                      >
                        <i className="fa-solid fa-trash text-sm"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Framework Information */}
        {task.framework_tags && task.framework_tags.length > 0 && (
          <Card>
            <h4 className="text-text-high font-medium mb-3">Compliance Frameworks</h4>
            <div className="flex flex-wrap gap-2">
              {task.framework_tags.map((framework, index) => (
                <span key={index} className="bg-brand-blue/20 text-brand-blue px-3 py-1 rounded-full text-sm">
                  {framework}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Assignment Modal */}
        <AssignmentModal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          onAssign={handleAssignUser}
          users={availableUsers}
          currentAssignedId={task?.assigned_to}
          loading={loadingUsers}
        />
      </div>
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
      // Handle both UUID and integer IDs
      const userId = isNaN(selectedUserId) ? selectedUserId : parseInt(selectedUserId);
      onAssign(userId);
    }
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      'admin': 'bg-red-500/20 text-red-400',
      'manager': 'bg-blue-500/20 text-blue-400',
      'user': 'bg-green-500/20 text-green-400'
    };
    return colors[role] || 'bg-gray-500/20 text-gray-400';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Task to User"
      size="medium"
    >
      <div className="space-y-4">
        {/* Search */}
        <Input
          placeholder="Search users by name, email, or department..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        {/* User List */}
        <div className="max-h-80 overflow-y-auto space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="medium" />
              <span className="ml-3 text-text-muted">Loading team members...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <i className="fa-solid fa-users text-2xl mb-2"></i>
              <p>No team members found</p>
            </div>
          ) : (
            filteredUsers.map((user) => (
            <div
              key={user.id}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedUserId === user.id.toString()
                  ? 'border-brand-green bg-brand-green/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
              }`}
              onClick={() => {
                const userIdStr = user.id.toString();
                setSelectedUserId(selectedUserId === userIdStr ? '' : userIdStr);
              }}
            >
              <div className="flex items-center space-x-3">
                <UserAvatar 
                  fullName={user.full_name}
                  email={user.email}
                  size="sm"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-text-high font-medium text-sm">{user.full_name}</h4>
                      <p className="text-text-muted text-xs">{user.email}</p>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getRoleBadgeColor(user.role)}`}>
                        {user.role}
                      </span>
                      <span className="text-xs text-text-muted">{user.department}</span>
                    </div>
                  </div>
                </div>
                {selectedUserId === user.id.toString() && (
                  <i className="fa-solid fa-check text-brand-green"></i>
                )}
              </div>
            </div>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleAssign}
            disabled={!selectedUserId}
          >
            <i className="fa-solid fa-user-check mr-2"></i>
            Assign Task
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default TaskDetail;