// API URL configuration utility
export const getApiBaseURL = () => {
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

export const getApiURL = (endpoint) => {
  return `${getApiBaseURL()}${endpoint}`;
};