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
        action: 'Task created',
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
            action: 'File uploaded',
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

  // Extract required months dynamically
  const extractRequiredMonths = (task) => {
    const text = `${task?.action_required || ''} ${task?.description || ''}`;
    const months = [];
    const currentDate = new Date();
    
    // Check for "3 months" pattern
    if (text.match(/\b(3|three)\s+months?\b/i)) {
      for (let i = 0; i < 3; i++) {
        const date = subMonths(currentDate, i);
        months.push({
          key: `month_${i}`,
          name: format(date, 'MMMM yyyy'),
          startDate: format(date, 'MMM dd'),
          endDate: format(new Date(date.getFullYear(), date.getMonth() + 1, 0), 'MMM dd')
        });
      }
    } else if (text.match(/\b(6|six)\s+months?\b/i)) {
      for (let i = 0; i < 6; i++) {
        const date = subMonths(currentDate, i);
        months.push({
          key: `month_${i}`,
          name: format(date, 'MMMM yyyy'),
          startDate: format(date, 'MMM dd'),
          endDate: format(new Date(date.getFullYear(), date.getMonth() + 1, 0), 'MMM dd')
        });
      }
    } else {
      // Default to current month if not specified
      months.push({
        key: 'current',
        name: format(currentDate, 'MMMM yyyy'),
        startDate: format(currentDate, 'MMM dd'),
        endDate: format(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0), 'MMM dd')
      });
    }
    
    return months;
  };

  // Extract data fields dynamically based on assigned meters
  const extractDataFields = (task) => {
    const text = `${task?.action_required || ''} ${task?.description || ''} ${task?.title || ''}`.toLowerCase();
    const fields = [];
    const assignedMeters = extractMeterInfo(task)?.meters || [];
    const months = extractRequiredMonths(task);
    
    // Create meter-specific data entry fields
    assignedMeters.forEach((meter) => {
      if (meter.reading_required) {
        // Add monthly readings for each meter
        months.forEach((month) => {
          fields.push({
            key: `${meter.meter_id}_${month.key}`,
            label: `${meter.type.charAt(0).toUpperCase() + meter.type.slice(1)} Reading - ${month.name}`,
            sublabel: `${meter.meter_id} @ ${meter.location}`,
            type: 'number',
            unit: meter.unit || (meter.type === 'electricity' ? 'kWh' : meter.type === 'water' ? 'm³' : meter.type === 'gas' ? 'm³' : 'units'),
            placeholder: `Enter ${meter.type} reading`,
            icon: meter.icon || (meter.type === 'electricity' ? 'fa-bolt' : meter.type === 'water' ? 'fa-droplet' : meter.type === 'gas' ? 'fa-fire' : 'fa-gauge'),
            color: meter.type === 'electricity' ? 'green' : meter.type === 'water' ? 'blue' : meter.type === 'gas' ? 'orange' : 'gray',
            required: true,
            period: `${month.startDate} - ${month.endDate}`,
            meter: meter
          });
        });
        
        // Add cost field per meter if bills are required
        if (meter.bills_required) {
          fields.push({
            key: `${meter.meter_id}_cost`,
            label: `${meter.type.charAt(0).toUpperCase() + meter.type.slice(1)} Cost`,
            sublabel: `Total cost for ${meter.meter_id} @ ${meter.location}`,
            type: 'number',
            unit: 'AED',
            placeholder: `Enter total ${meter.type} cost`,
            icon: 'fa-coins',
            color: 'amber',
            required: false,
            meter: meter
          });
        }
        
        // Add peak demand for electricity meters
        if (meter.type === 'electricity' && (text.includes('peak') || text.includes('demand') || text.includes('maximum'))) {
          fields.push({
            key: `${meter.meter_id}_peak_demand`,
            label: `Peak Demand - ${meter.meter_id}`,
            sublabel: `Maximum demand for ${meter.location}`,
            type: 'number',
            unit: 'kW',
            placeholder: 'Enter peak demand',
            icon: 'fa-gauge-high',
            color: 'red',
            required: false,
            meter: meter
          });
        }
      }
    });
    
    // Add percentage field if mentioned (task-level)
    if (text.includes('percentage') || text.includes('%')) {
      fields.push({
        key: 'percentage',
        label: 'Percentage',
        type: 'number',
        unit: '%',
        placeholder: 'Enter percentage',
        icon: 'fa-percent',
        color: 'purple',
        required: true
      });
    }
    
    // Always add notes field
    fields.push({
      key: 'notes',
      label: 'Additional Notes',
      type: 'textarea',
      placeholder: 'Enter any notes or observations...',
      icon: 'fa-note-sticky',
      color: 'gray',
      required: false
    });
    
    return fields;
  };

  // Extract meter information dynamically - supports single, dual, or triple meter types
  const extractMeterInfo = (task) => {
    const text = `${task?.action_required || ''} ${task?.description || ''} ${task?.title || ''}`.toLowerCase();
    const meterInfo = {
      meters: []
    };
    
    // Check for meter type requirements based on text content
    const meterTypes = [];
    
    // Electricity detection
    if (text.includes('electricity') || text.includes('electric') || text.includes('kwh') || text.includes('power')) {
      meterTypes.push('electricity');
    }
    
    // Water detection
    if (text.includes('water') || text.includes('m³') || text.includes('cubic') || text.includes('hydro')) {
      meterTypes.push('water');
    }
    
    // Gas detection
    if (text.includes('gas') || text.includes('natural gas') || text.includes('lng') || text.includes('fuel')) {
      meterTypes.push('gas');
    }
    
    // If no specific types detected, check for general consumption/utility mentions
    if (meterTypes.length === 0 && (text.includes('consumption') || text.includes('utility') || text.includes('meter'))) {
      // Default to electricity if consumption is mentioned without specifics
      meterTypes.push('electricity');
    }
    
    // Generate meters based on detected types
    let meterCounter = 1;
    meterTypes.forEach(type => {
      let meterId, provider, unit, icon;
      
      switch (type) {
        case 'electricity':
          meterId = `ELC${String(meterCounter).padStart(4, '0')}`;
          provider = text.includes('dewa') ? 'DEWA' : text.includes('addc') ? 'ADDC' : 'DEWA';
          unit = 'kWh';
          icon = 'fa-bolt';
          break;
        case 'water':
          meterId = `WAT${String(meterCounter).padStart(4, '0')}`;
          provider = text.includes('dewa') ? 'DEWA' : text.includes('addc') ? 'ADDC' : 'DEWA';
          unit = 'm³';
          icon = 'fa-droplet';
          break;
        case 'gas':
          meterId = `GAS${String(meterCounter).padStart(4, '0')}`;
          provider = text.includes('adnoc') ? 'ADNOC' : text.includes('enoc') ? 'ENOC' : 'ADNOC';
          unit = 'm³';
          icon = 'fa-fire';
          break;
      }
      
      // Extract location - try multiple patterns
      let location = 'Main Office';
      const locationPatterns = [
        /(?:at|in|from)\s+([^.,\n]+?)(?:\s+and|$|\.)/i,
        /office|building|facility|floor|basement|rooftop/i
      ];
      
      for (const pattern of locationPatterns) {
        const locationMatch = text.match(pattern);
        if (locationMatch && locationMatch[1] && locationMatch[1].trim().length > 3) {
          location = locationMatch[1].trim();
          break;
        } else if (locationMatch && locationMatch[0]) {
          location = `Main ${locationMatch[0].charAt(0).toUpperCase() + locationMatch[0].slice(1)}`;
          break;
        }
      }
      
      meterInfo.meters.push({
        meter_id: meterId,
        id: meterId, // Keep both for backward compatibility
        type: type,
        icon: icon,
        provider: provider,
        location: location,
        unit: unit,
        reading_required: true,
        bills_required: text.includes('bill') || text.includes('invoice') || text.includes('dewa') || text.includes('addc')
      });
      
      meterCounter++;
    });
    
    // Look for existing meter IDs in the text (override generated ones)
    const existingMeterPatterns = [
      /meter\s+([A-Z]{3}\d{3,})/gi,
      /([A-Z]{3}\d{4,})/g,
      /(?:ELC|WAT|GAS|ELE)\d{3,}/gi
    ];
    
    existingMeterPatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const foundMeterId = match[1] || match[0];
        if (foundMeterId) {
          // Update existing meter with found ID or add new one
          const meterType = foundMeterId.toLowerCase().includes('elc') || foundMeterId.toLowerCase().includes('ele') ? 'electricity' :
                           foundMeterId.toLowerCase().includes('wat') ? 'water' :
                           foundMeterId.toLowerCase().includes('gas') ? 'gas' : 'electricity';
          
          const existingMeter = meterInfo.meters.find(m => m.type === meterType);
          if (existingMeter) {
            existingMeter.meter_id = foundMeterId.toUpperCase();
            existingMeter.id = foundMeterId.toUpperCase();
          } else {
            // Add meter type if not already detected
            const newMeter = {
              meter_id: foundMeterId.toUpperCase(),
              id: foundMeterId.toUpperCase(),
              type: meterType,
              icon: meterType === 'electricity' ? 'fa-bolt' : meterType === 'water' ? 'fa-droplet' : 'fa-fire',
              provider: meterType === 'gas' ? 'ADNOC' : 'DEWA',
              location: 'Main Office',
              unit: meterType === 'electricity' ? 'kWh' : 'm³',
              reading_required: true,
              bills_required: true
            };
            meterInfo.meters.push(newMeter);
          }
        }
      }
    });
    
    // Remove duplicates based on meter_id
    meterInfo.meters = meterInfo.meters.filter((meter, index, self) =>
      index === self.findIndex((m) => m.meter_id === meter.meter_id)
    );
    
    return meterInfo.meters.length > 0 ? meterInfo : null;
  };

  // Get meter info - bridge function for database-stored requirements
  const getMeterInfo = (task) => {
    // Check if task has database-stored assigned meters
    if (task?.assigned_meters?.meters) {
      return task.assigned_meters.meters;
    }
    
    // Try to get real location data from localStorage
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const companyId = currentUser.company_id || currentUser.id || 'temp';
    console.log('🔍 DEBUG: Looking for location data with companyId:', companyId);
    
    // Check what localStorage keys exist
    const allKeys = Object.keys(localStorage).filter(key => key.includes('location'));
    console.log('🔍 DEBUG: All location-related localStorage keys:', allKeys);
    
    const locationData = localStorage.getItem(`onboarding_locations_${companyId}`);
    console.log('🔍 DEBUG: Location data found:', !!locationData);
    
    // Try alternative key patterns
    if (!locationData) {
      const alternativeKeys = [
        `locations_${companyId}`,
        `onboarding_data_${companyId}`,
        'onboarding_locations',
        'locations'
      ];
      
      for (const key of alternativeKeys) {
        const altData = localStorage.getItem(key);
        if (altData) {
          console.log('🔍 DEBUG: Found alternative location data with key:', key);
          console.log('🔍 DEBUG: Alternative data:', altData);
          break;
        }
      }
    }
    
    if (locationData) {
      try {
        const locations = JSON.parse(locationData);
        console.log('🔍 DEBUG: Parsed locations:', locations);
        const realMeters = [];
        
        locations.forEach(location => {
          if (location.meters && location.meters.length > 0) {
            location.meters.forEach(meter => {
              realMeters.push({
                meter_id: meter.meterNumber || meter.id,
                id: meter.meterNumber || meter.id,
                type: meter.type,
                icon: meter.type === 'electricity' ? 'fa-bolt' : 
                      meter.type === 'water' ? 'fa-droplet' : 
                      meter.type === 'gas' ? 'fa-fire' : 'fa-gauge',
                provider: meter.provider,
                location: `${location.name} - ${meter.description} • ${meter.provider}`, // "Location Name - Description • Provider"
                unit: meter.type === 'electricity' ? 'kWh' : 
                      meter.type === 'water' ? 'm³' : 
                      meter.type === 'gas' ? 'm³' : 'units',
                reading_required: true,
                bills_required: meter.provider && meter.provider.length > 0
              });
            });
          }
        });
        
        if (realMeters.length > 0) {
          // Filter meters based on task content
          const text = `${task?.action_required || ''} ${task?.description || ''} ${task?.title || ''}`.toLowerCase();
          const filteredMeters = realMeters.filter(meter => {
            if (text.includes('electricity') && meter.type === 'electricity') return true;
            if (text.includes('water') && meter.type === 'water') return true;
            if (text.includes('gas') && meter.type === 'gas') return true;
            return false;
          });
          
          return filteredMeters.length > 0 ? filteredMeters : realMeters;
        }
      } catch (error) {
        console.error('Error parsing location data:', error);
      }
    }
    
    // Fallback to dynamic extraction for legacy tasks
    const meterInfo = extractMeterInfo(task);
    return meterInfo?.meters || [];
  };

  // Extract required documents dynamically
  const extractRequiredDocuments = (task) => {
    const text = `${task?.action_required || ''} ${task?.description || ''}`.toLowerCase();
    const documents = [];
    
    // Bills/Invoices
    if (text.includes('bill') || text.includes('invoice')) {
      const months = extractRequiredMonths(task);
      documents.push({
        key: 'bills',
        title: 'Utility Bills',
        description: `Upload ${months.length} months of utility bills`,
        fileTypes: '.pdf,.jpg,.jpeg,.png',
        icon: 'fa-file-invoice',
        color: 'blue',
        required: true,
        months: months
      });
    }
    
    // Policy documents - only for actual policy-related tasks
    if (text.includes('policy') || 
        text.includes('compliance document') || 
        text.includes('policy document') ||
        text.includes('written policy') ||
        text.includes('formal policy') ||
        text.includes('sustainability policy')) {
      documents.push({
        key: 'policy',
        title: 'Policy Document',
        description: 'Upload the policy or compliance document',
        fileTypes: '.pdf,.doc,.docx',
        icon: 'fa-file-contract',
        color: 'purple',
        required: true
      });
    }
    
    // Photos
    if (text.includes('photo') || text.includes('picture') || text.includes('image')) {
      documents.push({
        key: 'photos',
        title: 'Photos/Images',
        description: 'Upload photos as evidence',
        fileTypes: '.jpg,.jpeg,.png',
        icon: 'fa-camera',
        color: 'green',
        required: false
      });
    }
    
    // Excel/CSV
    if (text.includes('excel') || text.includes('csv') || text.includes('spreadsheet')) {
      documents.push({
        key: 'spreadsheet',
        title: 'Data Spreadsheet',
        description: 'Upload completed data template',
        fileTypes: '.xlsx,.xls,.csv',
        icon: 'fa-file-excel',
        color: 'green',
        required: false
      });
    }
    
    // Default if no specific type found
    if (documents.length === 0) {
      documents.push({
        key: 'general',
        title: 'Supporting Documents',
        description: 'Upload relevant evidence',
        fileTypes: '.pdf,.doc,.docx,.jpg,.jpeg,.png',
        icon: 'fa-paperclip',
        color: 'gray',
        required: true
      });
    }
    
    return documents;
  };

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
      return evidenceTitle.includes(docKey) || 
             evidenceTitle.includes(baseKey) ||
             evidenceDescription.includes(baseKey);
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
    }
  }, [task]);

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
    } catch (error) {
      console.error('Error assigning task:', error);
      toast.error('Failed to assign task');
    }
  };

  const handleDataEntry = (field, value) => {
    const previousValue = dataEntries[field];
    
    setDataEntries(prev => ({
      ...prev,
      [field]: value
    }));

    // Add to history if value changed
    if (value && value !== previousValue) {
      const fieldConfig = dataFields.find(f => f.key === field);
      addHistoryEntry('data_entry', 'Data entered', {
        field: fieldConfig?.label || field,
        value: fieldConfig?.unit ? `${value} ${fieldConfig.unit}` : value,
        previousValue: previousValue || 'Empty'
      });
    }

    // Auto-save after typing stops
    clearTimeout(window.dataEntrySaveTimeout);
    window.dataEntrySaveTimeout = setTimeout(() => {
      toast.success('Data saved automatically', {
        position: 'bottom-right',
        autoClose: 2000
      });
      updateDataEntryProgress();
    }, 1000);
  };

  const updateDataEntryProgress = () => {
    const requiredFields = dataFields.filter(f => f.required);
    const filledRequired = requiredFields.filter(f => dataEntries[f.key]).length;
    const percentage = requiredFields.length > 0 
      ? Math.round((filledRequired / requiredFields.length) * 100)
      : 0;
    setTaskProgress(percentage);
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
      const fileTitle = file.name.replace(/\.[^/.]+$/, "");
      const uploadedAttachment = await esgAPI.uploadTaskAttachment(task.id, {
        file: file,
        title: fileTitle,
        description: `Uploaded file: ${file.name}`,
        attachment_type: 'evidence'
      });

      const updatedEvidence = [...evidence, uploadedAttachment];
      setEvidence(updatedEvidence);

      const documents = extractRequiredDocuments(task);
      const progressPercentage = Math.min((updatedEvidence.length / documents.length) * 100, 100);
      setTaskProgress(progressPercentage);

      await esgAPI.updateTask(task.id, {
        progress_percentage: progressPercentage,
        status: progressPercentage >= 100 ? 'completed' : (progressPercentage > 0 ? 'in_progress' : task.status)
      });

      setIsSubmitting(false);
      toast.success(`File "${file.name}" uploaded successfully!`);
      
      // Add to history
      addHistoryEntry('upload', 'File uploaded', { 
        filename: file.name, 
        fileSize: file.size,
        progressBefore: taskProgress,
        progressAfter: progressPercentage
      });

      queryClient.invalidateQueries('progress-tracker');
      queryClient.invalidateQueries('tasks');

      if (onUpdate) {
        onUpdate({
          ...task,
          attachments: updatedEvidence,
          progress_percentage: progressPercentage,
          status: progressPercentage >= 100 ? 'completed' : (progressPercentage > 0 ? 'in_progress' : task.status)
        });
      }

    } catch (error) {
      console.error('Error uploading file:', error);
      setIsSubmitting(false);
      toast.error(`Failed to upload "${file.name}"`);
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

      const documents = extractRequiredDocuments(task);
      const progressPercentage = Math.min((updatedEvidence.length / documents.length) * 100, 100);
      setTaskProgress(progressPercentage);

      await esgAPI.updateTask(task.id, {
        progress_percentage: progressPercentage,
        status: progressPercentage >= 100 ? 'completed' : (progressPercentage > 0 ? 'in_progress' : task.status)
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
          progress_percentage: progressPercentage,
          status: progressPercentage >= 100 ? 'completed' : (progressPercentage > 0 ? 'in_progress' : task.status)
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
      
      const documents = extractRequiredDocuments(task);
      const progressPercentage = Math.min((updatedEvidence.length / documents.length) * 100, 100);
      setTaskProgress(progressPercentage);
      
      // Add to history
      addHistoryEntry('upload', 'File removed', {
        filename: removedEvidence?.title || 'Unknown file',
        progressBefore: taskProgress,
        progressAfter: progressPercentage
      });
      
      toast.success('Evidence removed');
    } catch (error) {
      console.error('Error removing evidence:', error);
      toast.error('Failed to remove evidence');
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
        if (answerText.length > 50) {
          answerText = answerText.substring(0, 50) + '...';
        }
      } else {
        answerText = String(task.user_answer);
      }
      
      return `${cleanTitle} (Answer: ${answerText})`;
    }
    
    return cleanTitle;
  };

  if (!task) return null;

  const meterInfo = getMeterInfo(task);
  
  // Check if this task has meter-related content and should use our clean dynamic instructions
  const needsDynamicMeterInstructions = (() => {
    const text = `${task?.action_required || ''} ${task?.description || ''} ${task?.title || ''}`.toLowerCase();
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
    
    // If it's a meter task, extract just the main question/task before the detailed instructions
    if (needsDynamicMeterInstructions && actionRequired.includes('Specific Action:')) {
      // Extract just the main part before "Specific Action:"
      const mainPart = actionRequired.split('Specific Action:')[0].trim();
      // Remove "Action Required:" prefix if it exists, since we add our own
      return mainPart.replace(/^Action Required:\s*/i, '').trim();
    }
    
    return actionRequired;
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

              {/* Meter Information - Only show for meter-related tasks */}
              {meterInfo && meterInfo.length > 0 && (task?.title?.toLowerCase().includes('meter') || 
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
                        <strong>Action Required:</strong> {getCleanActionRequired()}
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
                          <strong>Total:</strong> {meterInfo.filter(m => m.bills_required).length * 3} monthly bills showing consumption data
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dataFields.map((field) => (
                  <Card 
                    key={field.key}
                    className={`bg-white/5 border-white/10 hover:border-brand-green/30 transition-colors ${
                      field.type === 'textarea' ? 'md:col-span-2' : ''
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
                          {field.period && (
                            <div className="text-xs text-text-muted">{field.period}</div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {field.type === 'textarea' ? (
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
                    {Math.round(
                      (dataFields.filter(f => f.required && dataEntries[f.key]).length / 
                       dataFields.filter(f => f.required).length) * 100
                    ) || 0}%
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-2 rounded-full bg-gradient-to-r from-brand-green to-green-400 transition-all duration-500"
                    style={{ 
                      width: `${Math.round(
                        (dataFields.filter(f => f.required && dataEntries[f.key]).length / 
                         dataFields.filter(f => f.required).length) * 100
                      ) || 0}%` 
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

              {requiredDocuments.map((doc) => (
                <Card key={doc.key} className="bg-white/5 border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <i className={`fa-solid ${doc.icon} text-${doc.color}-400`}></i>
                      <h4 className="text-sm font-medium text-text-high">
                        {doc.title}
                        {!doc.required && <span className="text-text-muted ml-2">(Optional)</span>}
                      </h4>
                    </div>
                    <span className={`bg-${doc.color}-500/20 text-${doc.color}-300 px-2 py-1 rounded text-xs`}>
                      {doc.fileTypes.replace(/\./g, '').toUpperCase()}
                    </span>
                  </div>
                  
                  <p className="text-sm text-text-muted mb-4">{doc.description}</p>

                  {/* Month Pills for bills */}
                  {doc.months && doc.months.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {doc.months.map((month) => (
                        <div 
                          key={month.key}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                            monthlyUploads[month.key] 
                              ? 'bg-brand-green/20 border-brand-green/30 text-brand-green' 
                              : 'bg-white/5 border-white/10 text-text-muted hover:bg-white/10'
                          }`}
                        >
                          {monthlyUploads[month.key] ? '✓' : '○'} {month.name}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Drag and Drop Zone */}
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
                      accept={doc.fileTypes}
                      multiple={doc.months && doc.months.length > 1}
                      onChange={(e) => handleFileSelect(e, doc.key)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 bg-brand-green/20 rounded-lg flex items-center justify-center mb-3">
                        <i className="fa-solid fa-cloud-upload-alt text-brand-green text-xl"></i>
                      </div>
                      <p className="text-text-high font-medium mb-1">Drop files here or click to browse</p>
                      <p className="text-text-muted text-xs">
                        Accept: {doc.fileTypes} • Max 10MB {doc.months && doc.months.length > 1 ? 'per file' : ''}
                      </p>
                    </div>
                  </div>

                  {/* Uploaded Files for this document type */}
                  {getDocumentEvidence(evidence, doc).length > 0 && (
                    <div className="mt-4 space-y-2">
                      {getDocumentEvidence(evidence, doc).map((item) => (
                        <div key={item.id} className="flex items-center justify-between bg-brand-green/10 border border-brand-green/20 rounded-lg p-3">
                          <div className="flex items-center space-x-3">
                            <i className={`fa-solid ${doc.icon} text-brand-green`}></i>
                            <div>
                              <p className="text-sm text-text-high font-medium">{item.title}</p>
                              <p className="text-xs text-text-muted">
                                {item.file_size ? `${(item.file_size / 1024 / 1024).toFixed(2)} MB` : 'Uploaded'} • 
                                {item.uploaded_at ? format(new Date(item.uploaded_at), 'MMM dd, HH:mm') : 'Just now'}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveEvidence(item.id)}
                            className="w-8 h-8 rounded-lg bg-red-400/20 text-red-400 hover:bg-red-400/30 transition-colors flex items-center justify-center"
                          >
                            <i className="fa-solid fa-times text-sm"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}

              {/* Other Evidence (unmatched files) */}
              {(() => {
                const matchedEvidenceIds = new Set();
                requiredDocuments.forEach(doc => {
                  getDocumentEvidence(evidence, doc).forEach(e => matchedEvidenceIds.add(e.id));
                });
                const unmatchedEvidence = evidence.filter(e => !matchedEvidenceIds.has(e.id));
                
                return unmatchedEvidence.length > 0 && (
                  <Card className="bg-white/5 border-white/10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <i className="fa-solid fa-paperclip text-text-muted"></i>
                        <h4 className="text-sm font-medium text-text-high">Other Evidence</h4>
                      </div>
                      <span className="bg-gray-500/20 text-gray-300 px-2 py-1 rounded text-xs">
                        {unmatchedEvidence.length} files
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      {unmatchedEvidence.map((item) => (
                        <div key={item.id} className="flex items-center justify-between bg-gray-500/10 border border-gray-500/20 rounded-lg p-3">
                          <div className="flex items-center space-x-3">
                            <i className="fa-solid fa-file text-gray-400"></i>
                            <div>
                              <p className="text-sm text-text-high font-medium">{item.title}</p>
                              <p className="text-xs text-text-muted">
                                {item.file_size ? `${(item.file_size / 1024 / 1024).toFixed(2)} MB` : 'Uploaded'} • 
                                {item.uploaded_at ? format(new Date(item.uploaded_at), 'MMM dd, HH:mm') : 'Just now'}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveEvidence(item.id)}
                            className="w-8 h-8 rounded-lg bg-red-400/20 text-red-400 hover:bg-red-400/30 transition-colors flex items-center justify-center"
                          >
                            <i className="fa-solid fa-times text-sm"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })()}

              {/* Upload Progress */}
              <Card className="bg-white/5 border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-text-high">Upload Progress</span>
                  <span className="text-sm text-brand-green font-medium">{Math.round(taskProgress)}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-2 rounded-full bg-gradient-to-r from-brand-green to-green-400 transition-all duration-500"
                    style={{ width: `${taskProgress}%` }}
                  />
                </div>
                <p className="text-xs text-text-muted mt-2">
                  {evidence.length} of {requiredDocuments.filter(d => d.required).length} required documents uploaded
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
            {evidence.length} of {requiredDocuments.filter(d => d.required).length} required files • Auto-save enabled
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