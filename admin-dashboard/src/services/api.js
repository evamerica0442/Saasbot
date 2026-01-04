import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = 'Bearer ' + token;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API Methods
export const apiService = {
  // Authentication
  login: (credentials) => api.post('/api/auth/login', credentials),
  
  // Tenants
  getTenants: () => api.get('/api/tenants'),
  getTenant: (tenantId) => api.get('/api/tenants/' + tenantId),
  createTenant: (data) => api.post('/api/tenants', data),
  updateTenant: (tenantId, data) => api.put('/api/tenants/' + tenantId, data),
  deleteTenant: (tenantId) => api.delete('/api/tenants/' + tenantId),
  getTenantStats: (tenantId) => api.get('/api/tenants/' + tenantId + '/stats'),
  reloadTenantPlugin: (tenantId) => api.post('/api/tenants/' + tenantId + '/reload'),
  
  // Orders
  getOrders: (params) => api.get('/api/orders', { params }),
  getOrder: (orderId) => api.get('/api/orders/' + orderId),
  updateOrderStatus: (orderId, tenantId, status) => 
    api.post('/api/orders/' + orderId + '/status', { tenant_id: tenantId, status }),
  
  // Menu Items
  getMenuItems: (tenantId) => api.get('/api/tenants/' + tenantId + '/menu'),
  createMenuItem: (tenantId, data) => api.post('/api/tenants/' + tenantId + '/menu', data),
  updateMenuItem: (tenantId, itemId, data) => 
    api.put('/api/tenants/' + tenantId + '/menu/' + itemId, data),
  deleteMenuItem: (tenantId, itemId) => 
    api.delete('/api/tenants/' + tenantId + '/menu/' + itemId),
  
  // Analytics
  getDashboardStats: () => api.get('/api/analytics/dashboard'),
  getTenantAnalytics: (tenantId, params) => 
    api.get('/api/analytics/tenant/' + tenantId, { params }),
  
  // Notifications
  sendNotification: (tenantId, customerPhone, message) =>
    api.post('/api/notifications/send', { tenant_id: tenantId, customer_phone: customerPhone, message }),
  
  // System
  getSystemStats: () => api.get('/api/system/stats'),
  clearCache: () => api.post('/api/system/clear-cache'),
};

export default api;
