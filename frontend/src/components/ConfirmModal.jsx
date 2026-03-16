import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText,
  confirmButtonColor = "bg-red-600 text-white shadow-red-500/30 hover:bg-red-700"
}) {
  const { t } = useLanguage();
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700">
        
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-5 shadow-inner">
            <AlertTriangle className="w-7 h-7 text-red-600 dark:text-red-400" />
          </div>
          
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {title || t.confirm_title}
          </h3>
          
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 leading-relaxed">
            {message || t.confirm_msg_default}
          </p>

          <div className="flex gap-3 w-full">
            <button 
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-600 transition active:scale-95"
            >
              {t.cancel}
            </button>
            
            <button 
              onClick={onConfirm}
              className={`flex-1 py-3 px-4 font-bold rounded-2xl shadow-lg transition active:scale-95 ${confirmButtonColor}`}
            >
              {confirmText || t.yes_delete}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}