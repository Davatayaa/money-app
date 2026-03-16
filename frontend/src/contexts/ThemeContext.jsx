import { createContext, useState, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem('notif') === 'true');

  useEffect(() => {
    const root = document.documentElement; 

    if (darkMode) {
      root.classList.add('dark');
      
      root.style.backgroundColor = '#111827'; 
      root.style.colorScheme = 'dark';
      
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      
      root.style.backgroundColor = '#f9fafb'; 
      root.style.colorScheme = 'light';
      
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('notif', notificationsEnabled);
  }, [notificationsEnabled]);

  const toggleTheme = () => setDarkMode(prev => !prev);
  const toggleNotifications = () => setNotificationsEnabled(prev => !prev);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleTheme, notificationsEnabled, toggleNotifications }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}