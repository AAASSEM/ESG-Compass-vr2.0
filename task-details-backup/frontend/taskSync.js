/**
 * Task synchronization utility
 * Syncs tasks from frontend localStorage to backend database
 */

import { esgAPI } from './api';

export class TaskSyncManager {
  constructor() {
    this.isDebugMode = true; // Set to false in production
  }

  /**
   * Debug logging helper
   */
  log(message, ...args) {
    if (this.isDebugMode) {
      console.log(`[TaskSync] ${message}`, ...args);
    }
  }

  /**
   * Get tasks from localStorage for a specific company
   */
  getLocalStorageTasks(companyId) {
    try {
      const tasksKey = `generatedTasks_${companyId}`;
      const tasksData = localStorage.getItem(tasksKey);
      
      if (!tasksData) {
        this.log(`No tasks found in localStorage for company ${companyId}`);
        return [];
      }

      const tasks = JSON.parse(tasksData);
      this.log(`Found ${tasks.length} tasks in localStorage for company ${companyId}`);
      
      return Array.isArray(tasks) ? tasks : [];
    } catch (error) {
      console.error('[TaskSync] Error reading tasks from localStorage:', error);
      return [];
    }
  }

  /**
   * Get assessment results from localStorage
   */
  getAssessmentResults(companyId) {
    try {
      const resultsKey = `assessmentResults_${companyId}`;
      const resultsData = localStorage.getItem(resultsKey);
      
      if (!resultsData) {
        this.log(`No assessment results found for company ${companyId}`);
        return null;
      }

      const results = JSON.parse(resultsData);
      this.log(`Found assessment results for company ${companyId}:`, {
        totalQuestions: results.totalQuestions,
        answeredQuestions: results.answeredQuestions,
        completionRate: results.completionRate,
        generatedTasks: results.generatedTasks?.length || 0
      });
      
      return results;
    } catch (error) {
      console.error('[TaskSync] Error reading assessment results from localStorage:', error);
      return null;
    }
  }

  /**
   * Sync tasks from localStorage to backend
   */
  async syncTasksToBackend(companyId, options = {}) {
    const {
      clearLocalStorage = false,
      forceSync = false
    } = options;

    try {
      this.log(`Starting task sync for company ${companyId}`);

      // Get tasks from localStorage
      const localTasks = this.getLocalStorageTasks(companyId);
      
      if (localTasks.length === 0) {
        this.log('No tasks to sync');
        return {
          success: true,
          message: 'No tasks to sync',
          created: 0,
          updated: 0,
          errors: 0
        };
      }

      // Prepare tasks data for backend
      const tasksForSync = localTasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority,
        status: task.status,
        due_date: task.due_date,
        compliance_context: task.compliance_context,
        action_required: task.action_required,
        framework_tags: task.framework_tags,
        sector: task.sector,
        estimated_hours: task.estimated_hours
      }));

      this.log(`Syncing ${tasksForSync.length} tasks to backend`);

      // Call backend API to sync tasks
      const syncResult = await esgAPI.syncFrontendTasks(tasksForSync);

      this.log('Sync completed successfully:', syncResult);

      // Optionally clear localStorage after successful sync
      if (clearLocalStorage && syncResult.error_count === 0) {
        this.clearLocalStorageTasks(companyId);
        this.log('Cleared localStorage tasks after successful sync');
      }

      return {
        success: true,
        message: syncResult.message,
        created: syncResult.created_count,
        updated: syncResult.updated_count,
        errors: syncResult.error_count,
        details: syncResult
      };

    } catch (error) {
      console.error('[TaskSync] Error syncing tasks to backend:', error);
      return {
        success: false,
        message: `Sync failed: ${error.message}`,
        created: 0,
        updated: 0,
        errors: 1,
        error
      };
    }
  }

  /**
   * Clear tasks from localStorage
   */
  clearLocalStorageTasks(companyId) {
    try {
      const tasksKey = `generatedTasks_${companyId}`;
      const resultsKey = `assessmentResults_${companyId}`;
      
      localStorage.removeItem(tasksKey);
      localStorage.removeItem(resultsKey);
      
      this.log(`Cleared localStorage data for company ${companyId}`);
      return true;
    } catch (error) {
      console.error('[TaskSync] Error clearing localStorage:', error);
      return false;
    }
  }

  /**
   * Check if there are tasks in localStorage that need syncing
   */
  hasUnsyncedTasks(companyId) {
    const tasks = this.getLocalStorageTasks(companyId);
    return tasks.length > 0;
  }

  /**
   * Get sync status for a company
   */
  getSyncStatus(companyId) {
    const tasks = this.getLocalStorageTasks(companyId);
    const assessmentResults = this.getAssessmentResults(companyId);
    
    return {
      hasLocalTasks: tasks.length > 0,
      localTasksCount: tasks.length,
      hasAssessmentResults: !!assessmentResults,
      assessmentCompletionRate: assessmentResults?.completionRate || 0,
      lastAssessmentDate: assessmentResults?.timestamp || null
    };
  }

  /**
   * Auto-sync tasks on page load or specific triggers
   */
  async autoSyncIfNeeded(companyId, options = {}) {
    const status = this.getSyncStatus(companyId);
    
    if (!status.hasLocalTasks) {
      this.log('No local tasks found, skipping auto-sync');
      return null;
    }

    this.log(`Auto-sync triggered for ${status.localTasksCount} tasks`);
    
    return await this.syncTasksToBackend(companyId, {
      clearLocalStorage: true, // Clear after successful sync
      ...options
    });
  }
}

// Create and export singleton instance
export const taskSyncManager = new TaskSyncManager();

// Export convenience functions
export const syncTasks = (companyId, options) => taskSyncManager.syncTasksToBackend(companyId, options);
export const hasUnsyncedTasks = (companyId) => taskSyncManager.hasUnsyncedTasks(companyId);
export const getSyncStatus = (companyId) => taskSyncManager.getSyncStatus(companyId);
export const autoSyncTasks = (companyId, options) => taskSyncManager.autoSyncIfNeeded(companyId, options);