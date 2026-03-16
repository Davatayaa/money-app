import { useState } from 'react';
import { User, CreditCard, FileText, Settings, LogOut, ChevronRight, Globe } from 'lucide-react'; 
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

import ExportModal from '@/components/ExportModal';
import SettingsModal from '@/components/SettingsModal';
import ConfirmModal from '@/components/ConfirmModal'; 
import ProfileModal from '@/components/ProfileModal';
import WalletManagerModal from '@/components/WalletManagerModal';
import DebtModal from '@/components/DebtModal';

export default function MorePage({ onUpdateData }) {
  const { t, language, toggleLanguage } = useLanguage();
  const appVersion = import.meta.env.VITE_APP_VERSION || "v1.0.0";
  
  const navigate = useNavigate();

  const [isExportOpen, setIsExportOpen] = useState(false); 
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false); 
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isDebtOpen, setIsDebtOpen] = useState(false);
  
  const handleLogoutClick = () => {
    setIsLogoutModalOpen(true);
  };

  const performLogout = () => {
    sessionStorage.removeItem('token'); 
    localStorage.removeItem('token');
    setIsLogoutModalOpen(false);
    window.location.href = '/login';
  };

  const menus = [
    { 
        icon: User, 
        label: t.profile || "Profil", 
        desc: t.profile_desc || "Kelola data diri",
        action: () => setIsProfileOpen(true)
    },
    { 
        icon: CreditCard, 
        label: t.rekening || "Rekening", 
        desc: t.rekening_desc || "Daftar rekening bank",
        action: () => setIsWalletModalOpen(true)
    },
    { 
        icon: BookOpen, 
        label: t.debt_menu, 
        desc: t.debt_desc,
        action: () => setIsDebtOpen(true),
        color: "text-indigo-500"
    },
    { 
        icon: FileText, 
        label: t.export_menu,
        desc: t.export_desc,
        action: () => setIsExportOpen(true) 
    },
    { 
        icon: Settings, 
        label: t.settings, 
        desc: language === 'id' ? "Tema Tampilan" : "Display Theme",
        action: () => setIsSettingsOpen(true) 
    },
    { 
        icon: Globe, 
        label: t.language, 
        desc: language === 'id' ? "Indonesia" : "English", 
        action: toggleLanguage,
        isLanguage: true 
    },
    { 
        icon: LogOut, 
        label: t.logout, 
        desc: t.logout_desc, 
        color: "text-red-500", 
        action: handleLogoutClick 
    },
  ];

  return (
    <>
        <div className="px-6 pt-14 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6">{t.more_title}</h2>
            
            <div className="space-y-3">
                {menus.map((menu, idx) => (
                    <div 
                        key={idx} 
                        onClick={menu.action ? menu.action : undefined}
                        className={`flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm cursor-pointer active:scale-95 transition ${menu.color ? 'hover:bg-red-50 dark:hover:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                    >
                        <div className={`p-3 rounded-full bg-gray-50 dark:bg-gray-700 ${menu.color || 'text-blue-600 dark:text-blue-400'}`}>
                           <menu.icon className="w-5 h-5" />
                        </div>
                        
                        <div className="flex-1">
                           <h3 className={`font-bold text-sm ${menu.color || 'text-gray-800 dark:text-white'}`}>{menu.label}</h3>
                           <p className="text-[10px] text-gray-400">{menu.desc}</p>
                        </div>
                        
                        {menu.isLanguage ? (
                            <span className="text-xs font-bold bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-2 py-1 rounded-md uppercase">
                                {language}
                            </span>
                        ) : (
                            <ChevronRight className={`w-4 h-4 ${menu.color ? 'text-red-300' : 'text-gray-300'}`} />
                        )}
                    </div>
                ))}
            </div>

            <p className="text-center text-[10px] text-gray-400 mt-10">{appVersion}</p>
        </div>

        
        <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        
        <ConfirmModal 
            isOpen={isLogoutModalOpen} 
            onClose={() => setIsLogoutModalOpen(false)} 
            onConfirm={performLogout} 
            title={t.logout} 
            message={t.logout_confirmation_msg} 
            confirmText={t.yes_logout}
        />

        <ProfileModal 
            isOpen={isProfileOpen} 
            onClose={() => setIsProfileOpen(false)} 
        />

        <WalletManagerModal 
            isOpen={isWalletModalOpen} 
            onClose={() => setIsWalletModalOpen(false)}
            onSuccess={onUpdateData} 
        />

        <DebtModal isOpen={isDebtOpen} onClose={() => setIsDebtOpen(false)} />
    </>
  );
}