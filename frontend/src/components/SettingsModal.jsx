import { X, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SettingsModal({ isOpen, onClose }) {
  const { t } = useLanguage();
  const { darkMode, toggleTheme } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 w-full max-w-xs rounded-2xl shadow-2xl p-5 animate-in zoom-in-95 duration-200">
        
        <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-gray-700 pb-3">
          <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
            {t.settings}
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
            
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-gray-600 rounded-full shadow-sm">
                    {darkMode ? <Moon className="w-5 h-5 text-blue-500" /> : <Sun className="w-5 h-5 text-orange-500" />}
                </div>
                <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-white">{t.dark_mode}</p>
                    <p className="text-[10px] text-gray-400">{darkMode ? t.active : t.inactive}</p>
                </div>
            </div>
            <button onClick={toggleTheme} className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${darkMode ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}