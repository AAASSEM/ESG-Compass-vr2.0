import { format } from 'date-fns';

/**
 * Shared utilities for extracting task requirements
 * Used by both TaskDetail.jsx and Tracker.jsx to ensure consistency
 */

// Extract required months for billing/tracking
export const extractRequiredMonths = (task) => {
  const text = `${task?.action_required || ''} ${task?.description || ''} ${task?.title || ''}`.toLowerCase();
  const months = [];
  
  // Don't extract months for fuel/generator tasks - they need purchase receipts, not monthly bills
  if (text.includes('fuel') && (text.includes('generator') || text.includes('diesel') || text.includes('petrol'))) {
    return months; // Return empty array
  }
  
  // Don't extract months for LPG tasks
  if (text.includes('lpg') && (text.includes('cooking') || text.includes('heating'))) {
    return months; // Return empty array
  }
  
  const currentDate = new Date();
  
  // Always return only current month for consistency
  months.push({
    key: 'current',
    name: format(currentDate, 'MMMM yyyy'),
    startDate: format(currentDate, 'MMM dd'),
    endDate: format(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0), 'MMM dd')
  });
  
  return months;
};

// Get meter information from task and user's location data
export const getMeterInfo = (task) => {
  // Check if task has database-stored assigned meters
  if (task?.assigned_meters?.meters) {
    return task.assigned_meters.meters;
  }
  
  // Try to get real location data from localStorage
  let currentUser = {};
  try {
    currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  } catch (error) {
    console.error('Error parsing user from localStorage:', error);
  }
  const companyId = currentUser.company_id || currentUser.id || 'temp';
  
  const locationData = localStorage.getItem(`onboarding_locations_${companyId}`);
  
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
        break;
      }
    }
  }
  
  if (locationData) {
    try {
      const locations = JSON.parse(locationData);
      if (!Array.isArray(locations)) {
        console.warn('Locations data is not an array:', locations);
        return [];
      }
      const realMeters = [];
      
      locations.forEach(location => {
        if (location && location.meters && Array.isArray(location.meters) && location.meters.length > 0) {
          location.meters.forEach(meter => {
            if (!meter || !meter.type) {
              console.warn('Invalid meter data:', meter);
              return;
            }
            realMeters.push({
              meter_id: meter.meterNumber || meter.id,
              id: meter.meterNumber || meter.id,
              type: meter.type,
              icon: meter.type === 'electricity' ? 'fa-bolt' : 
                    meter.type === 'water' ? 'fa-droplet' : 
                    meter.type === 'gas' ? 'fa-fire' : 'fa-gauge',
              provider: meter.provider,
              location: `${location.name} - ${meter.description}`,
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
        
        // Determine what meter types the task requires
        const requiresElectricity = text.includes('electricity') || text.includes('electric') || text.includes('kwh') || text.includes('power');
        const requiresWater = text.includes('water') || text.includes('m³') || text.includes('cubic meter');
        const requiresGas = text.includes('gas') || text.includes('natural gas') || text.includes('lpg') || text.includes('cooking gas') || text.includes('heating gas');
        
        console.log('🔍 getMeterInfo DEBUG:', {
          taskTitle: task?.title,
          taskText: text,
          requiresElectricity,
          requiresWater,
          requiresGas,
          totalRealMeters: realMeters.length,
          realMeterTypes: realMeters.map(m => m.type),
          realMeterIds: realMeters.map(m => m.meter_id || m.id)
        });
        
        const filteredMeters = realMeters.filter(meter => {
          if (requiresElectricity && meter.type === 'electricity') return true;
          if (requiresWater && meter.type === 'water') return true;
          if (requiresGas && meter.type === 'gas') return true;
          return false;
        });
        
        // Add missing meter types info to the result for warnings
        const missingTypes = [];
        if (requiresElectricity && !filteredMeters.find(m => m.type === 'electricity')) {
          missingTypes.push('electricity');
        }
        if (requiresWater && !filteredMeters.find(m => m.type === 'water')) {
          missingTypes.push('water');
        }
        if (requiresGas && !filteredMeters.find(m => m.type === 'gas')) {
          missingTypes.push('gas');
        }
        
        console.log('🔍 getMeterInfo FILTERING:', {
          filteredMetersCount: filteredMeters.length,
          filteredMeterTypes: filteredMeters.map(m => m.type),
          missingTypes,
          willReturnMeters: filteredMeters.length
        });
        
        // Add missing meter info to the first meter for UI display
        if (filteredMeters.length > 0 && missingTypes.length > 0) {
          filteredMeters[0].missingMeterTypes = missingTypes;
          console.log('✅ Added missingMeterTypes to first meter:', missingTypes);
        }
        
        // ALWAYS return available meters, even if not all required types are available
        // The UI will handle missing meter warnings separately
        return filteredMeters;
      }
    } catch (error) {
      console.error('Error parsing location data:', error);
    }
  }
  
  // No real meters found - check if task actually needs meters
  const text = `${task?.action_required || ''} ${task?.description || ''} ${task?.title || ''}`.toLowerCase();
  const needsMeters = text.includes('meter') || text.includes('electricity') || text.includes('water') || text.includes('gas') || 
                     text.includes('consumption') || text.includes('read meters') || text.includes('utility bills');
  
  if (needsMeters) {
    // Return empty array - this will trigger a "no meters" warning in the UI
    return [];
  }
  
  // For non-meter tasks, don't generate fake meters
  return [];
};

// Extract data fields dynamically based on assigned meters
export const extractDataFields = (task) => {
  const text = `${task?.action_required || ''} ${task?.description || ''} ${task?.title || ''}`.toLowerCase();
  const fields = [];
  
  // Skip meter readings for fuel and cooling tasks
  // Only skip if task is ONLY about fuel, not if it mentions electricity/gas too
  const isFuelOnlyTask = (text.includes('fuel') || text.includes('generator') || text.includes('diesel') || text.includes('petrol')) && 
                        !text.includes('electricity') && !text.includes('electric') && !text.includes('gas') && !text.includes('water');
  const isCoolingTask = text.includes('cooling') || text.includes('district cooling');
  
  // Always check what meter types the task needs
  const text_lower = text.toLowerCase();
  const requiresElectricity = text_lower.includes('electricity') || text_lower.includes('electric') || text_lower.includes('kwh') || text_lower.includes('power');
  const requiresWater = text_lower.includes('water') || text_lower.includes('m³') || text_lower.includes('cubic meter');
  const requiresGas = text_lower.includes('gas') || text_lower.includes('natural gas') || text_lower.includes('lpg') || text_lower.includes('cooking gas') || text_lower.includes('heating gas');
  const needsAnyMeter = requiresElectricity || requiresWater || requiresGas;
  
  // Get available meters (may be empty if user hasn't set up meters)
  const assignedMeters = getMeterInfo(task) || [];
  const hasMeters = assignedMeters.length > 0;
  
  console.log('🔍 extractDataFields DEBUG:', {
    taskTitle: task?.title,
    requiresElectricity,
    requiresWater,
    requiresGas,
    needsAnyMeter,
    assignedMetersCount: assignedMeters.length,
    assignedMeterTypes: assignedMeters.map(m => m.type),
    hasMeters,
    isFuelOnlyTask,
    isCoolingTask,
    willProcessMeterTask: !isFuelOnlyTask && !isCoolingTask && needsAnyMeter
  });
  
  // Process meter-related tasks - always process if task needs meters (even if user doesn't have them)
  if (!isFuelOnlyTask && !isCoolingTask && needsAnyMeter) {
    const months = extractRequiredMonths(task);
    
    console.log('🚀 About to process meter data fields:', {
      assignedMetersLength: assignedMeters.length,
      assignedMetersArray: assignedMeters,
      monthsLength: months.length
    });
    
    // Create meter-specific data entry fields
    console.log('📋 Creating data fields for meters...');
    assignedMeters.forEach((meter, meterIndex) => {
      console.log(`  🔸 Processing meter ${meterIndex + 1}:`, {
        meterId: meter.meter_id || meter.id,
        type: meter.type,
        reading_required: meter.reading_required
      });
      
      if (meter.reading_required) {
        // Add monthly readings for each meter
        months.forEach((month) => {
          const fieldKey = `${meter.meter_id}_${month.key}`;
          console.log(`    📝 Adding data field: ${fieldKey}`);
          fields.push({
            key: fieldKey,
            label: `${meter.type.charAt(0).toUpperCase() + meter.type.slice(1)} Reading - ${month.name}`,
            sublabel: `Meter: ${meter.meter_id} • Location: ${meter.location}`,
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
          sublabel: `Meter: ${meter.meter_id} • Location: ${meter.location}`,
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
          label: `Peak Demand`,
          sublabel: `Meter: ${meter.meter_id} • Location: ${meter.location}`,
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
  
  // Handle missing meter types - generate warning fields for meters user doesn't have
  if (hasMeters) {
    // Check what meter types are missing
    const availableMeterTypes = assignedMeters.map(m => m.type);
    const missingTypes = [];
    
    if (requiresElectricity && !availableMeterTypes.includes('electricity')) {
      missingTypes.push('electricity');
    }
    if (requiresWater && !availableMeterTypes.includes('water')) {
      missingTypes.push('water');
    }
    if (requiresGas && !availableMeterTypes.includes('gas')) {
      missingTypes.push('gas');
    }
    
    // Add missing meter info to fields for UI display
    if (missingTypes.length > 0 && fields.length > 0) {
      fields[0].missingMeterTypes = missingTypes;
    }
  } else if (needsAnyMeter) {
    // No meters available at all, but task needs them - create a warning field
    const requiredTypes = [];
    if (requiresElectricity) requiredTypes.push('electricity');
    if (requiresWater) requiredTypes.push('water');
    if (requiresGas) requiredTypes.push('gas');
    
    // Add a placeholder field that shows the missing meter warning
    fields.push({
      key: 'no_meters_warning',
      label: 'Meter Reading Required',
      type: 'warning',
      icon: 'fa-exclamation-triangle',
      color: 'amber',
      required: false,
      missingMeterTypes: requiredTypes,
      warningMessage: `This task requires ${requiredTypes.join(', ')} meter${requiredTypes.length > 1 ? 's' : ''}. Please add ${requiredTypes.length > 1 ? 'these meter types' : 'this meter type'} to your location settings.`
    });
  }
  
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
  
  console.log('📊 extractDataFields FINAL RESULT:', {
    taskTitle: task?.title,
    totalFieldsGenerated: fields.length,
    fieldTypes: fields.map(f => f.type),
    fieldKeys: fields.map(f => f.key),
    meterFields: fields.filter(f => f.meter).length,
    warningFields: fields.filter(f => f.type === 'warning').length
  });
  
  return fields;
};

// Extract required documents dynamically
export const extractRequiredDocuments = (task) => {
  const text = `${task?.action_required || ''} ${task?.description || ''}`.toLowerCase();
  const documents = [];
  
  // Check if this is a meter task and get meter info
  const meterInfo = getMeterInfo(task);
  const isMetersTask = text.includes('bill') || text.includes('invoice') || text.includes('meter') || text.includes('consumption');
  
  // Bills/Invoices - Create one document requirement per meter that needs bills
  if (isMetersTask && meterInfo && meterInfo.length > 0) {
    const metersRequiringBills = meterInfo.filter(meter => meter.bills_required);
    
    metersRequiringBills.forEach((meter, index) => {
      const months = extractRequiredMonths(task);
      documents.push({
        key: `bills_${meter.meter_id || meter.id}`,
        title: 'Supporting Documents',
        description: `Upload ${months.length} month${months.length > 1 ? 's' : ''} of ${meter.type} bills (${meter.meter_id || meter.id})`,
        fileTypes: '.pdf,.jpg,.jpeg,.png',
        icon: 'fa-file-text',
        color: 'blue',
        required: true,
        months: months,
        meter: meter
      });
    });
  } else if (text.includes('bill') || text.includes('invoice')) {
    // Fallback for non-meter bill tasks
    const months = extractRequiredMonths(task);
    documents.push({
      key: 'bills',
      title: 'Supporting Documents',
      description: `Upload ${months.length} months of utility bills`,
      fileTypes: '.pdf,.jpg,.jpeg,.png',
      icon: 'fa-file-text',
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
      title: 'Supporting Documents',
      description: 'Upload the policy or compliance document',
      fileTypes: '.pdf,.doc,.docx',
      icon: 'fa-file-text',
      color: 'purple',
      required: true
    });
  }
  
  // Photos
  if (text.includes('photo') || text.includes('picture') || text.includes('image')) {
    documents.push({
      key: 'photos',
      title: 'Supporting Documents',
      description: 'Upload photos as evidence',
      fileTypes: '.jpg,.jpeg,.png',
      icon: 'fa-file-text',
      color: 'green',
      required: false
    });
  }
  
  // Excel/CSV
  if (text.includes('excel') || text.includes('csv') || text.includes('spreadsheet')) {
    documents.push({
      key: 'spreadsheet',
      title: 'Supporting Documents',
      description: 'Upload completed data template',
      fileTypes: '.xlsx,.xls,.csv',
      icon: 'fa-file-text',
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
      icon: 'fa-file-text',
      color: 'gray',
      required: true
    });
  }
  
  console.log('📋 extractRequiredDocuments RESULT:', {
    taskTitle: task?.title?.substring(0, 50) + '...',
    isMetersTask,
    meterCount: meterInfo?.length || 0,
    documentsGenerated: documents.length,
    documentTypes: documents.map(d => d.key)
  });
  
  return documents;
};

// Helper function to get task requirements (used by Tracker)
export const getTaskRequirements = (task) => {
  const dataFields = extractDataFields(task);
  const documents = extractRequiredDocuments(task);
  
  return {
    expectedDataFields: dataFields.filter(f => f.required).length,
    expectedFiles: documents.filter(d => d.required).length,
    dataFields: dataFields,
    documents: documents
  };
};