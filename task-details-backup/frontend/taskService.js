/**
 * Task service for backend API integration
 * Handles task operations including meter enhancement
 */

import { esgAPI } from './api';

export const taskService = {
  /**
   * Regenerate tasks with meter information using backend API
   */
  async regenerateTasksWithMeters(clearExisting = false) {
    try {
      const response = await fetch('/api/tasks/regenerate-with-meters/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          clear_existing: clearExisting
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Backend tasks regenerated with meters:', data);
      return data;
    } catch (error) {
      console.error('❌ Error regenerating tasks with meters:', error);
      throw error;
    }
  },

  /**
   * Sync frontend localStorage tasks to backend database
   */
  async syncFrontendTasks(tasks) {
    try {
      const response = await fetch('/api/tasks/sync-frontend/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          tasks: tasks
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Frontend tasks synced to backend:', data);
      return data;
    } catch (error) {
      console.error('❌ Error syncing frontend tasks:', error);
      throw error;
    }
  },

  /**
   * Get tasks from backend API
   */
  async getTasks(filters = {}) {
    try {
      return await esgAPI.getTasks(filters);
    } catch (error) {
      console.warn('Backend API unavailable, falling back to localStorage');
      throw error;
    }
  },

  /**
   * Create task via backend API
   */
  async createTask(taskData) {
    try {
      return await esgAPI.createTask(taskData);
    } catch (error) {
      console.warn('Backend API unavailable for task creation');
      throw error;
    }
  },

  /**
   * Update task via backend API
   */
  async updateTask(taskId, taskData) {
    try {
      return await esgAPI.updateTask(taskId, taskData);
    } catch (error) {
      console.warn('Backend API unavailable for task update');
      throw error;
    }
  },

  /**
   * Get task statistics from backend
   */
  async getTaskStats() {
    try {
      const response = await fetch('/api/tasks/stats/', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.warn('Backend stats unavailable');
      throw error;
    }
  }
};

export default taskService;