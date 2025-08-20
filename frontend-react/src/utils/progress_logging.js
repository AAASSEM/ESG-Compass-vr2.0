import React from 'react';

// progressLogger.js - Centralized progress tracking system

class ProgressLogger {
  constructor() {
    this.baseStorageKey = 'esg_progress_log';
    this.currentUser = null;
    this.storageKey = this.baseStorageKey; // Will be updated when user is set
  }

  // Set current user to isolate progress data per user
  setUser(user) {
    if (!user || !user.email) {
      console.warn('⚠️ ProgressLogger: Invalid user provided');
      return;
    }

    const newUserKey = `${this.baseStorageKey}_${user.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    // If user changed, clear the current instance and switch storage
    if (this.currentUser?.email !== user.email) {
      console.log(`🔄 ProgressLogger: Switching user from ${this.currentUser?.email || 'none'} to ${user.email}`);
      this.currentUser = user;
      this.storageKey = newUserKey;
      
      // Verify isolation by logging current storage
      console.log(`📝 ProgressLogger: Using storage key: ${this.storageKey}`);
    }
  }

  // Clear all progress data for current user
  clearUserProgress() {
    if (this.currentUser) {
      console.log(`🗑️ ProgressLogger: Clearing progress for user ${this.currentUser.email}`);
      localStorage.removeItem(this.storageKey);
    }
  }

  // Static method to clear progress when user logs out
  static clearAllProgress() {
    console.log('🗑️ ProgressLogger: Clearing all progress data (user logout)');
    // Clear all progress logger keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('esg_progress_log')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  // Initialize progress log for a task
  initializeTask(taskId, taskData) {
    const log = this.getLog();
    
    if (!log.tasks[taskId]) {
      log.tasks[taskId] = {
        id: taskId,
        title: taskData.title,
        category: taskData.category,
        created_at: new Date().toISOString(),
        files: {
          required: taskData.expected_files || 0,
          uploaded: 0,
          items: []
        },
        data_entries: {
          required_fields: [], // Will be populated when fields are detected
          completed_fields: [],
          entries: {}
        },
        overall_progress: 0,
        status: 'pending',
        last_updated: new Date().toISOString()
      };
      
      this.saveLog(log);
    }
    
    return log.tasks[taskId];
  }

  // Log file upload
  logFileUpload(taskId, fileData) {
    const log = this.getLog();
    const task = log.tasks[taskId];
    
    if (task) {
      // Add file to uploaded items
      task.files.items.push({
        id: fileData.id,
        filename: fileData.title || fileData.original_filename,
        size: fileData.file_size,
        uploaded_at: new Date().toISOString(),
        type: fileData.attachment_type || 'evidence'
      });
      
      task.files.uploaded = task.files.items.length;
      task.last_updated = new Date().toISOString();
      
      // Update overall progress
      this.updateOverallProgress(taskId);
      
      this.saveLog(log);
      
      console.log(`📁 PROGRESS LOG: File uploaded for task ${taskId}`, {
        filename: fileData.title,
        newCount: task.files.uploaded,
        required: task.files.required
      });
    }
  }

  // Log file removal
  logFileRemoval(taskId, fileId) {
    const log = this.getLog();
    const task = log.tasks[taskId];
    
    if (task) {
      // Remove file from items
      task.files.items = task.files.items.filter(item => item.id !== fileId);
      task.files.uploaded = task.files.items.length;
      task.last_updated = new Date().toISOString();
      
      // Update overall progress
      this.updateOverallProgress(taskId);
      
      this.saveLog(log);
      
      console.log(`🗑️ PROGRESS LOG: File removed from task ${taskId}`, {
        newCount: task.files.uploaded,
        required: task.files.required
      });
    }
  }

  // Update data entry fields when they're detected/changed
  updateDataFields(taskId, fields) {
    const log = this.getLog();
    const task = log.tasks[taskId];
    
    if (task) {
      // Update required fields list
      task.data_entries.required_fields = fields.map(field => ({
        key: field.key,
        label: field.label,
        required: field.required,
        type: field.type
      }));
      
      task.last_updated = new Date().toISOString();
      this.saveLog(log);
      
      console.log(`📝 PROGRESS LOG: Data fields updated for task ${taskId}`, {
        totalFields: fields.length,
        requiredFields: fields.filter(f => f.required).length
      });
    }
  }

  // Log data entry
  logDataEntry(taskId, fieldKey, value, fieldInfo = null) {
    const log = this.getLog();
    const task = log.tasks[taskId];
    
    if (task) {
      // Update data entry
      task.data_entries.entries[fieldKey] = {
        value: value,
        updated_at: new Date().toISOString(),
        field_info: fieldInfo
      };
      
      // Update completed fields list
      const requiredFields = task.data_entries.required_fields.filter(f => f.required);
      task.data_entries.completed_fields = requiredFields.filter(field => {
        const entry = task.data_entries.entries[field.key];
        return entry && entry.value && entry.value.toString().trim().length > 0;
      }).map(f => f.key);
      
      task.last_updated = new Date().toISOString();
      
      // Update overall progress
      this.updateOverallProgress(taskId);
      
      this.saveLog(log);
      
      console.log(`📊 PROGRESS LOG: Data entry for task ${taskId}`, {
        field: fieldKey,
        value: value,
        completedFields: task.data_entries.completed_fields.length,
        requiredFields: requiredFields.length
      });
    }
  }

  // Update required file count (when task requirements change)
  updateRequiredFiles(taskId, requiredCount) {
    const log = this.getLog();
    const task = log.tasks[taskId];
    
    if (task && task.files.required !== requiredCount) {
      task.files.required = requiredCount;
      task.last_updated = new Date().toISOString();
      
      // Update overall progress
      this.updateOverallProgress(taskId);
      
      this.saveLog(log);
      
      console.log(`📋 PROGRESS LOG: Required files updated for task ${taskId}`, {
        newRequired: requiredCount,
        uploaded: task.files.uploaded
      });
    }
  }

  // Calculate and update overall progress for a task
  updateOverallProgress(taskId) {
    const log = this.getLog();
    const task = log.tasks[taskId];
    
    if (!task) return;
    
    // Calculate file progress
    const fileProgress = task.files.required > 0 ? 
      Math.min((task.files.uploaded / task.files.required) * 100, 100) : 100;
    
    // Calculate data entry progress
    const requiredDataFields = task.data_entries.required_fields.filter(f => f.required).length;
    const completedDataFields = task.data_entries.completed_fields.length;
    const dataProgress = requiredDataFields > 0 ? 
      (completedDataFields / requiredDataFields) * 100 : 100;
    
    // Overall progress is average of both (or 100% if no requirements)
    let overallProgress = 0;
    if (task.files.required > 0 && requiredDataFields > 0) {
      // Both files and data required
      overallProgress = (fileProgress + dataProgress) / 2;
    } else if (task.files.required > 0) {
      // Only files required
      overallProgress = fileProgress;
    } else if (requiredDataFields > 0) {
      // Only data required
      overallProgress = dataProgress;
    } else {
      // No requirements (shouldn't happen, but handle gracefully)
      overallProgress = 100;
    }
    
    // Update status based on progress
    task.overall_progress = Math.round(overallProgress);
    task.status = overallProgress >= 100 ? 'completed' : 
                 overallProgress > 0 ? 'in_progress' : 'pending';
    
    console.log(`📈 PROGRESS LOG: Overall progress updated for task ${taskId}`, {
      fileProgress: Math.round(fileProgress),
      dataProgress: Math.round(dataProgress),
      overallProgress: task.overall_progress,
      status: task.status
    });
  }

  // Get current log
  getLog() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error reading progress log:', error);
    }
    
    // Default log structure
    return {
      version: '1.0',
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      tasks: {}
    };
  }

  // Save log to localStorage
  saveLog(log) {
    try {
      log.last_updated = new Date().toISOString();
      localStorage.setItem(this.storageKey, JSON.stringify(log));
    } catch (error) {
      console.error('Error saving progress log:', error);
    }
  }

  // Get progress summary for tracker
  getProgressSummary() {
    const log = this.getLog();
    const tasks = Object.values(log.tasks);
    
    if (tasks.length === 0) {
      return {
        dataProgress: { overall: 0, completed: 0, total: 0, environmental: 0, social: 0, governance: 0 },
        evidenceProgress: { overall: 0, completed: 0, total: 0, environmental: 0, social: 0, governance: 0 },
        taskSummary: { total: 0, completed: 0, in_progress: 0, pending: 0 }
      };
    }
    
    let totalFiles = { expected: 0, uploaded: 0 };
    let totalData = { expected: 0, completed: 0 };
    let taskCounts = { total: 0, completed: 0, in_progress: 0, pending: 0 };
    
    // Category breakdowns
    const categories = {
      environmental: { files: { expected: 0, uploaded: 0 }, data: { expected: 0, completed: 0 } },
      social: { files: { expected: 0, uploaded: 0 }, data: { expected: 0, completed: 0 } },
      governance: { files: { expected: 0, uploaded: 0 }, data: { expected: 0, completed: 0 } }
    };
    
    tasks.forEach(task => {
      const category = task.category || 'general';
      
      // File progress
      totalFiles.expected += task.files.required;
      totalFiles.uploaded += task.files.uploaded;
      
      // Data progress
      const requiredDataFields = task.data_entries.required_fields.filter(f => f.required).length;
      const completedDataFields = task.data_entries.completed_fields.length;
      totalData.expected += requiredDataFields;
      totalData.completed += completedDataFields;
      
      // Task status counts
      taskCounts.total += 1;
      taskCounts[task.status] = (taskCounts[task.status] || 0) + 1;
      
      // Category progress
      if (categories[category]) {
        categories[category].files.expected += task.files.required;
        categories[category].files.uploaded += task.files.uploaded;
        categories[category].data.expected += requiredDataFields;
        categories[category].data.completed += completedDataFields;
      }
    });
    
    // Calculate percentages
    const dataPercentage = totalData.expected > 0 ? 
      Math.round((totalData.completed / totalData.expected) * 100) : 100;
    
    const evidencePercentage = totalFiles.expected > 0 ? 
      Math.round((totalFiles.uploaded / totalFiles.expected) * 100) : 100;
    
    // Calculate category percentages
    const getCategoryPercentage = (category, type) => {
      const cat = categories[category];
      if (!cat) return 0;
      
      if (type === 'data') {
        return cat.data.expected > 0 ? 
          Math.round((cat.data.completed / cat.data.expected) * 100) : 100;
      } else {
        return cat.files.expected > 0 ? 
          Math.round((cat.files.uploaded / cat.files.expected) * 100) : 100;
      }
    };
    
    console.log('📊 PROGRESS SUMMARY FROM LOG:', {
      dataProgress: `${totalData.completed}/${totalData.expected} (${dataPercentage}%)`,
      evidenceProgress: `${totalFiles.uploaded}/${totalFiles.expected} (${evidencePercentage}%)`,
      taskCounts
    });
    
    return {
      dataProgress: {
        overall: dataPercentage,
        completed: totalData.completed,
        total: totalData.expected,
        environmental: getCategoryPercentage('environmental', 'data'),
        social: getCategoryPercentage('social', 'data'),
        governance: getCategoryPercentage('governance', 'data')
      },
      evidenceProgress: {
        overall: evidencePercentage,
        completed: totalFiles.uploaded,
        total: totalFiles.expected,
        environmental: getCategoryPercentage('environmental', 'evidence'),
        social: getCategoryPercentage('social', 'evidence'),
        governance: getCategoryPercentage('governance', 'evidence')
      },
      taskSummary: taskCounts
    };
  }

  // Get task-specific metrics for detailed breakdown
  getTaskMetrics(category, viewMode) {
    const log = this.getLog();
    const tasks = Object.values(log.tasks).filter(task => 
      task.category === category || task.title.toLowerCase().includes(category.toLowerCase())
    );
    
    if (tasks.length === 0) {
      return [{
        name: `No ${category} tasks`,
        status: 'pending',
        evidence: '0/0'
      }];
    }
    
    return tasks.slice(0, 4).map(task => {
      let status = 'pending';
      let evidenceText = '';
      
      if (viewMode === 'data') {
        // Data entry view
        const requiredFields = task.data_entries.required_fields.filter(f => f.required).length;
        const completedFields = task.data_entries.completed_fields.length;
        
        if (completedFields >= requiredFields && requiredFields > 0) {
          status = 'complete';
        } else if (completedFields > 0) {
          status = 'in_progress';
        }
        
        evidenceText = requiredFields > 0 ? `${completedFields}/${requiredFields} fields` : 'No data required';
        
      } else {
        // Evidence/file view
        const requiredFiles = task.files.required;
        const uploadedFiles = task.files.uploaded;
        
        if (uploadedFiles >= requiredFiles && requiredFiles > 0) {
          status = 'complete';
        } else if (uploadedFiles > 0) {
          status = 'in_progress';
        }
        
        evidenceText = requiredFiles > 0 ? `${uploadedFiles}/${requiredFiles} files` : 'No files required';
      }
      
      return {
        name: task.title.length > 35 ? task.title.substring(0, 35) + '...' : task.title,
        status: status,
        evidence: evidenceText
      };
    });
  }

  // Get next steps based on incomplete tasks
  getNextSteps() {
    const log = this.getLog();
    const tasks = Object.values(log.tasks);
    
    if (tasks.length === 0) {
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
    
    // Check if all tasks are completed
    const completedTasks = tasks.filter(task => task.status === 'completed');
    const allCompleted = completedTasks.length === tasks.length;
    
    if (allCompleted) {
      return [{
        id: 'all-completed',
        title: '🎉 All Tasks Completed!',
        description: 'Congratulations! You have successfully completed all ESG compliance tasks.',
        priority: 'completed',
        action: 'Generate Reports',
        icon: 'fa-trophy',
        color: 'green',
        isCompleted: true
      }];
    }
    
    // Get incomplete tasks sorted by priority
    const incompleteTasks = tasks.filter(task => task.status !== 'completed')
      .sort((a, b) => {
        // Sort by progress (lower progress first) then by category
        const progressDiff = a.overall_progress - b.overall_progress;
        if (progressDiff !== 0) return progressDiff;
        
        // Secondary sort by category priority
        const categoryPriority = { environmental: 1, social: 2, governance: 3 };
        return (categoryPriority[a.category] || 4) - (categoryPriority[b.category] || 4);
      })
      .slice(0, 3);
    
    return incompleteTasks.map(task => ({
      id: task.id,
      title: task.title,
      description: `${task.category} compliance task - ${task.overall_progress}% complete`,
      priority: task.status === 'in_progress' ? 'high' : 'medium',
      action: task.status === 'in_progress' ? 'Continue' : 'Start',
      icon: task.category === 'environmental' ? 'fa-leaf' :
            task.category === 'social' ? 'fa-users' : 'fa-shield-halved',
      color: task.status === 'in_progress' ? 'red' : 
             task.category === 'environmental' ? 'green' :
             task.category === 'social' ? 'blue' : 'purple',
      isCompleted: false,
      progress: task.overall_progress
    }));
  }

  // Sync task data from database (call this when tasks are loaded)
  syncWithDatabase(tasks) {
    const log = this.getLog();
    let hasChanges = false;
    
    tasks.forEach(task => {
      const existingTask = log.tasks[task.id];
      
      if (!existingTask) {
        // Initialize new task
        this.initializeTask(task.id, {
          title: task.title,
          category: task.category,
          expected_files: task.expected_files || 0
        });
        hasChanges = true;
      } else {
        // Update file count from database attachments
        const dbFileCount = task.attachments ? task.attachments.length : 0;
        if (existingTask.files.uploaded !== dbFileCount) {
          existingTask.files.uploaded = dbFileCount;
          existingTask.files.items = (task.attachments || []).map(att => ({
            id: att.id,
            filename: att.title || att.original_filename,
            size: att.file_size,
            uploaded_at: att.uploaded_at || new Date().toISOString(),
            type: att.attachment_type || 'evidence'
          }));
          hasChanges = true;
        }
        
        // Update data entries from database
        if (task.data_entries) {
          const dbEntries = task.data_entries;
          const logEntries = existingTask.data_entries.entries;
          
          // Check if database has different data
          const dbKeys = Object.keys(dbEntries);
          const logKeys = Object.keys(logEntries);
          
          if (JSON.stringify(dbKeys.sort()) !== JSON.stringify(logKeys.sort())) {
            // Update from database
            Object.keys(dbEntries).forEach(key => {
              if (dbEntries[key]) {
                logEntries[key] = {
                  value: dbEntries[key],
                  updated_at: new Date().toISOString(),
                  field_info: null
                };
              }
            });
            
            // Update completed fields
            const requiredFields = existingTask.data_entries.required_fields.filter(f => f.required);
            existingTask.data_entries.completed_fields = requiredFields.filter(field => {
              const entry = logEntries[field.key];
              return entry && entry.value && entry.value.toString().trim().length > 0;
            }).map(f => f.key);
            
            hasChanges = true;
          }
        }
        
        // Update overall progress
        if (hasChanges) {
          this.updateOverallProgress(task.id);
        }
      }
    });
    
    if (hasChanges) {
      this.saveLog(log);
      console.log('🔄 PROGRESS LOG: Synced with database');
    }

    return hasChanges;
  }

  // Clear log (for testing/reset)
  clearLog() {
    localStorage.removeItem(this.storageKey);
    console.log('🗑️ PROGRESS LOG: Cleared');
  }

  // Export log data (for debugging)
  exportLog() {
    return this.getLog();
  }
}

// Create singleton instance
export const progressLogger = new ProgressLogger();

// Helper functions for TaskDetail.jsx integration
export const useProgressLogger = (taskId, task) => {
  const logger = progressLogger;
  
  // Set current user for ProgressLogger isolation
  React.useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user && user.email) {
      logger.setUser(user);
    }
  }, []);
  
  // Initialize task on mount
  React.useEffect(() => {
    if (task && taskId) {
      logger.initializeTask(taskId, {
        title: task.title,
        category: task.category,
        expected_files: task.expected_files || 0
      });
    }
  }, [taskId, task?.title]);
  
  return {
    progressLogger: logger, // Expose the logger instance for direct access
    logFileUpload: (fileData) => logger.logFileUpload(taskId, fileData),
    logFileRemoval: (fileId) => logger.logFileRemoval(taskId, fileId),
    logDataEntry: (fieldKey, value, fieldInfo) => logger.logDataEntry(taskId, fieldKey, value, fieldInfo),
    updateDataFields: (fields) => logger.updateDataFields(taskId, fields),
    updateRequiredFiles: (count) => logger.updateRequiredFiles(taskId, count),
    getTaskProgress: () => {
      const log = logger.getLog();
      return log.tasks[taskId];
    }
  };
};

export default ProgressLogger;


