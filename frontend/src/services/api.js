import axios from 'axios';
import { loaderState } from '@/components/GlobalLoader';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.method !== 'get' && !config.skipLoading) {
      loaderState.show();
    }
    
    return config;
  },
  (error) => {
    loaderState.hide();
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    loaderState.hide();
    return response;
  },
  (error) => {
    loaderState.hide();

    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      
      const serverMsg = error.response.data?.error || "";
      let reason = "session_expired";

      if (serverMsg.includes("dinonaktifkan")) {
        reason = "account_blocked";
      } else if (serverMsg.includes("dihapus")) {
        reason = "account_deleted";
      }

      window.location.href = `/login?error=${reason}`;
    }
    return Promise.reject(error);
  }
);

export default api;