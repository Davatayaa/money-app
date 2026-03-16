import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api'; 

const AuthContext = createContext();

export function AuthProvider({ children }) {

  const [token, setToken] = useState(() => localStorage.getItem('token'));


  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1";

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const login = () => {
    window.location.href = `${API_BASE_URL}/auth/google-login`;
  };

  const logout = async () => {
    try {
        console.log("Mengirim sinyal logout ke server...");
        await api.post('/logout'); 
    } catch (error) {
        console.error("Gagal lapor logout ke server (tapi tetap lanjut logout di HP):", error);
    } finally {

        setToken(null);
        localStorage.removeItem('token');
        
        window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider value={{ token, setToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}