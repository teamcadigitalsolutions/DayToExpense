import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    // Return standard API response payload from backend
    return response?.data ?? response ?? {};
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 422 Validation Errors from FastAPI
    if (error.response?.status === 422 && Array.isArray(error.response.data?.detail)) {
      const messages = error.response.data.detail.map((err: any) => {
        const field = err.loc ? err.loc[err.loc.length - 1] : 'Field';
        return `${field}: ${err.msg}`;
      });
      error.response.data.detail = messages.join('\n');
    }

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/login')) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const res = await axios.post('/api/v1/auth/refresh', { refresh_token: refreshToken });
          const access_token = res.data?.data?.access_token;
          if (access_token) {
            localStorage.setItem('accessToken', access_token);
            api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
            originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
            return api(originalRequest);
          }
        }
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
