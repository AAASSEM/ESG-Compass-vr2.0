import axios from 'axios';

// Create axios instance pointing directly to Django (updated to port 8000)
// Use ngrok/Render URL for remote access, fallback to localhost for development
const getBaseURL = () => {
  // If we're accessing via ngrok, use the ngrok URL for API calls
  if (window.location.hostname.includes('ngrok-free.app')) {
    return `https://${window.location.hostname}/api`;
  }
  // If we're accessing via Render, use the Render URL for API calls
  if (window.location.hostname.includes('onrender.com')) {
    return `https://${window.location.hostname}/api`;
  }
  // Otherwise use localhost for development
  return 'http://localhost:8000/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// CSRF token utilities
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// Request interceptor to add auth token and CSRF token
api.interceptors.request.use(
  (config) => {
    // Check if we're in demo mode
    const demoMode = localStorage.getItem('demo_mode');
    
    if (!demoMode) {
      // Only add auth token if not in demo mode
      const token = localStorage.getItem('access_token') || localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    
    // Add CSRF token for state-changing requests
    if (['post', 'put', 'patch', 'delete'].includes(config.method)) {
      const csrfToken = getCookie('csrftoken');
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh and network errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle network disconnection
    if (!error.response) {
      console.error('Network error - no response received:', error.message);
      if (error.code === 'ERR_NETWORK' || error.message.includes('ERR_INTERNET_DISCONNECTED')) {
        // Don't retry immediately for network errors
        return Promise.reject({
          ...error,
          isNetworkError: true,
          userMessage: 'Network connection lost. Please check your internet connection and try again.'
        });
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post('/api/auth/token/refresh/', {
            refresh: refreshToken,
          });

          const { access } = response.data;
          localStorage.setItem('access_token', access);

          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

class ESGPlatformAPI {
  // ==================== Authentication Methods ====================

  async getCSRFToken() {
    try {
      await api.get('/auth/csrf/');
      return getCookie('csrftoken');
    } catch (error) {
      console.error('Error getting CSRF token:', error);
      return null;
    }
  }

  async register(userData) {
    try {
      // Debug logging
      console.log('API baseURL:', api.defaults.baseURL);
      console.log('Full registration URL:', api.defaults.baseURL + '/auth/register/');
      
      // First get CSRF token
      await this.getCSRFToken();
      
      const response = await api.post('/auth/register/', {
        email: userData.email,
        password: userData.password,
        confirm_password: userData.password,
        full_name: userData.full_name,
        first_name: userData.first_name,
        last_name: userData.last_name,
        phone_number: userData.phone_number || '',
        job_title: userData.job_title || '',
        company_name: userData.company_name || 'My Company',
        business_sector: userData.business_sector || 'other',
        company_data: userData.company_data || {}
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Registration error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      // Extract detailed error messages
      let errorMessage = 'Registration failed';
      if (error.response?.data) {
        const data = error.response.data;
        if (typeof data === 'object') {
          // Handle Django validation errors
          const errors = Object.entries(data).map(([field, msgs]) => {
            const messages = Array.isArray(msgs) ? msgs : [msgs];
            return `${field}: ${messages.join(', ')}`;
          }).join('; ');
          errorMessage = errors || errorMessage;
        } else if (typeof data === 'string') {
          errorMessage = data;
        }
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }
  }

  async login(email, password) {
    try {
      const response = await api.post('/auth/login/', { email, password });
      const { access, refresh, user } = response.data;
      
      // Store tokens and user data
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('user', JSON.stringify(user));

      return { success: true, user };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Login failed' 
      };
    }
  }

  async logout() {
    try {
      await api.post('/auth/logout/');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearAuth();
    }
  }

  async getCurrentUser() {
    const response = await api.get('/auth/me/');
    const userData = response.data;
    localStorage.setItem('user', JSON.stringify(userData));
    return userData;
  }

  clearAuth() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  }

  isAuthenticated() {
    const token = localStorage.getItem('access_token') || localStorage.getItem('authToken');
    return !!token && !!localStorage.getItem('user');
  }

  // ==================== Company Methods ====================

  async getCompany() {
    const response = await api.get('/companies/me/');
    return response.data;
  }

  async createCompany(companyData) {
    const response = await api.post('/companies/', companyData);
    return response.data;
  }

  async updateCompany(companyId, companyData) {
    try {
      // Use the specific update endpoint based on what data is being updated
      if (companyData.main_location || companyData.setup_step === 3) {
        // This is location data (step 2)
        const response = await api.post('/companies/update_locations/', companyData);
        return response.data; // Returns { message, locations_count, locations }
      } else {
        // This is business info data (step 1)
        console.log('Sending business info to Django:', companyData);
        const response = await api.post('/companies/update_business_info/', companyData);
        console.log('Django business info response:', response.data);
        return response.data.company;
      }
    } catch (error) {
      console.error('Company update error:', error);
      console.error('Error response data:', error.response?.data);
      console.error('Error status:', error.response?.status);
      throw error;
    }
  }

  async getCompanyLocations() {
    const response = await api.get('/companies/locations/');
    return response.data;
  }

  async createLocation(locationData) {
    const response = await api.post('/companies/locations/', locationData);
    return response.data;
  }

  async updateScopingData(scopingData) {
    const response = await api.post('/companies/update_scoping_data/', scopingData);
    return response.data;
  }

  async getProgressTracker() {
    const response = await api.get('/companies/progress_tracker/');
    return response.data;
  }

  // ==================== ESG Assessment Methods ====================

  async getESGFrameworks() {
    const response = await api.get('/esg/frameworks/');
    return response.data;
  }

  async getESGAssessments() {
    const response = await api.get('/esg/assessments/');
    return response.data;
  }

  async createESGAssessment(assessmentData) {
    const response = await api.post('/esg/assessments/', assessmentData);
    return response.data;
  }

  async getESGQuestions(category = null, framework = null) {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (framework) params.append('framework', framework);
    
    const url = `/esg/questions/${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await api.get(url);
    return response.data;
  }

  async submitESGResponse(responseData) {
    const response = await api.post('/esg/responses/', responseData);
    return response.data;
  }

  async uploadESGEvidence(responseId, fileData) {
    const formData = new FormData();
    formData.append('file', fileData.file);
    formData.append('title', fileData.title || '');
    formData.append('description', fileData.description || '');

    const response = await api.post(`/esg/responses/${responseId}/evidence/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }

  // ==================== Task Methods ====================

  async getTasks(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    
    const url = `/tasks/${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await api.get(url);
    return response.data;
  }

  async createTask(taskData) {
    const response = await api.post('/tasks/', taskData);
    return response.data;
  }

  async updateTask(taskId, taskData) {
    const response = await api.patch(`/tasks/${taskId}/`, taskData);
    return response.data;
  }

  async deleteTask(taskId) {
    await api.delete(`/tasks/${taskId}/`);
    return true;
  }

  async getTaskAttachments(taskId) {
    try {
      const response = await api.get(`/tasks/${taskId}/attachments/`);
      return response.data.attachments || [];
    } catch (error) {
      if (error.isNetworkError) {
        throw new Error('Network connection lost. Please check your internet connection.');
      }
      if (error.response?.status === 404) {
        console.warn(`Task ${taskId} not found or has no attachments`);
        return [];
      }
      throw error;
    }
  }

  async uploadTaskAttachment(taskId, fileData) {
    try {
      const formData = new FormData();
      formData.append('file', fileData.file);
      formData.append('title', fileData.title || '');
      formData.append('description', fileData.description || '');
      formData.append('attachment_type', fileData.attachment_type || 'evidence');

      // Use the correct backend endpoint
      const response = await api.post(`/tasks/${taskId}/upload_attachment/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data.attachment;
    } catch (error) {
      if (error.isNetworkError) {
        throw new Error('Network connection lost. Please check your internet connection.');
      }
      throw error;
    }
  }

  async deleteTaskAttachment(taskId, attachmentId) {
    try {
      const response = await api.delete(`/tasks/${taskId}/attachments/${attachmentId}/`);
      return response.data;
    } catch (error) {
      if (error.isNetworkError) {
        throw new Error('Network connection lost. Please check your internet connection.');
      }
      throw error;
    }
  }

  async syncFrontendTasks(tasks) {
    const response = await api.post('/tasks/sync-frontend/', { tasks });
    return response.data;
  }

  // ==================== Dashboard Methods ====================

  async getDashboardOverview() {
    const response = await api.get('/dashboard/overview/');
    return response.data;
  }

  async getSocialFileData() {
    const response = await api.get('/dashboard/social/file-data/');
    return response.data;
  }

  async getEnvironmentalFileData() {
    const response = await api.get('/dashboard/environmental/file-data/');
    return response.data;
  }

  async getGovernanceFileData() {
    const response = await api.get('/dashboard/governance/file-data/');
    return response.data;
  }

  async getDashboardMetrics(metricType = null) {
    const url = `/dashboard/metrics/${metricType ? `?metric_type=${metricType}` : ''}`;
    const response = await api.get(url);
    return response.data;
  }

  // Alias methods for dashboard compatibility
  async getMetrics(metricType = null) {
    return this.getDashboardMetrics(metricType);
  }

  async getKPIs() {
    try {
      const response = await api.get('/dashboard/overview/');
      return response.data.kpis || [];
    } catch (error) {
      console.error('Error fetching KPIs:', error);
      return [];
    }
  }

  async getDashboardAlerts() {
    const response = await api.get('/dashboard/alerts/');
    return response.data;
  }

  async markAlertAsRead(alertId) {
    const response = await api.post(`/dashboard/alerts/${alertId}/read/`);
    return response.data;
  }

  // ==================== Reports Methods ====================

  async getReportTemplates() {
    try {
      console.log('Fetching report templates from:', `${api.defaults.baseURL}/reports/templates/`);
      const response = await api.get('/reports/templates/');
      console.log('Templates API response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching templates:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
      } else if (error.request) {
        console.error('Request made but no response:', error.request);
      } else {
        console.error('Error message:', error.message);
      }
      throw error;
    }
  }

  async generateReport(reportData) {
    const response = await api.post('/reports/generate/', reportData);
    return response.data;
  }

  async getGeneratedReports() {
    const response = await api.get('/reports/');
    return response.data;
  }

  async getReports(filters = {}) {
    const params = new URLSearchParams();
    if (filters.date_range) params.append('date_range', filters.date_range);
    if (filters.status) params.append('status', filters.status);
    if (filters.template_type) params.append('template_type', filters.template_type);
    
    const response = await api.get(`/reports/generated/?${params.toString()}`);
    return response.data;
  }

  async downloadReport(reportId) {
    console.log('📡 API: Downloading report with ID:', reportId);
    console.log('📡 API: Request URL:', `/reports/generated/${reportId}/download/`);
    
    const response = await api.get(`/reports/generated/${reportId}/download/`, {
      responseType: 'blob'
    });
    
    console.log('📡 API: Response status:', response.status);
    console.log('📡 API: Response headers:', response.headers);
    
    // Extract filename from Content-Disposition header
    let filename = `report_${reportId}.pdf`;
    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition) {
      console.log('📡 API: Content-Disposition header:', contentDisposition);
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).?\\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }
    
    // Return blob and filename for the caller to handle download
    const blob = response.data;
    console.log('📡 API: Blob size:', blob.size, 'bytes');
    console.log('📡 API: Final filename:', filename);
    
    return { blob, filename };
  }

  async deleteReport(reportId) {
    console.log('🗑️ API: Deleting report with ID:', reportId);
    const response = await api.delete(`/reports/generated/${reportId}/`);
    console.log('🗑️ API: Delete response status:', response.status);
    return response.data;
  }

  async updateReport(reportId, data) {
    console.log('✏️ API: Updating report with ID:', reportId, 'Data:', data);
    const response = await api.patch(`/reports/generated/${reportId}/`, data);
    console.log('✏️ API: Update response status:', response.status);
    return response.data;
  }

  // ==================== User Management Methods ====================

  async getTeamMembers() {
    const response = await api.get('/users/team/members/');
    return response.data;
  }

  async inviteTeamMember(invitationData) {
    const response = await api.post('/users/invitations/', invitationData);
    return response.data;
  }

  async updateUserRole(userId, roleData) {
    const response = await api.patch(`/users/${userId}/role/`, roleData);
    return response.data;
  }

  // ==================== Demo Request ====================

  async requestDemo(demoData) {
    const response = await api.post('/auth/demo-request/', demoData);
    return response.data;
  }

  // ==================== Utility Methods ====================

  getFilenameFromResponse(response) {
    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).?\\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        return filenameMatch[1].replace(/['"]/g, '');
      }
    }
    return null;
  }
}

// Create and export API instance
export const esgAPI = new ESGPlatformAPI();
export default api;