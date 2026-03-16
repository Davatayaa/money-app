import { useState, useEffect } from 'react';
import { X, LogOut, Shield, Mail, Wallet, Users } from 'lucide-react';
import api from '@/services/api';
import ConfirmModal from './ConfirmModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate, useLocation } from 'react-router-dom';

export default function ProfileModal({ isOpen, onClose }) {
  const { t } = useLanguage();
  
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [isSwitchConfirmOpen, setIsSwitchConfirmOpen] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation(); 

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.get('/auth/me') 
        .then(res => {
          setUserData(res.data.data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Gagal load profile:", err);
          setLoading(false);
        });
    }
  }, [isOpen]);

  const performSwitchAccount = () => {
    sessionStorage.removeItem('token');
    localStorage.removeItem('token'); 
    window.location.href = '/login';
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300 border border-gray-100 dark:border-gray-800">
          
          <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition z-20 text-white">
              <X className="w-5 h-5" />
          </button>

          <div className="h-32 bg-blue-600 dark:bg-blue-900 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 text-white/10 rotate-12">
                  <Wallet className="w-32 h-32" />
              </div>
          </div>

          <div className="px-6 relative -mt-12 text-center pb-8">
              <div className="relative inline-block mb-4">
                  <div className="w-24 h-24 rounded-full p-1 bg-white dark:bg-gray-900 shadow-xl relative z-10">
                    {userData?.avatar_url ? (
                        <img 
                            src={userData.avatar_url} 
                            alt="Profile" 
                            referrerPolicy="no-referrer"
                            className="w-full h-full rounded-full object-cover"
                            onError={(e) => {
                                e.target.onerror = null; 
                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData?.name || 'User')}&background=random`;
                            }}
                        />
                    ) : (
                        <div className="w-full h-full rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-500 font-bold text-2xl uppercase">
                            {userData?.name?.charAt(0) || "U"}
                        </div>
                    )}
                  </div>

                  {userData?.role === 'admin' && (
                      <div className="absolute -bottom-1 right-0 z-20 bg-purple-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full border-2 border-white dark:border-gray-900 shadow-sm uppercase">
                          Admin
                      </div>
                  )}
              </div>

              {loading ? (
                  <div className="space-y-2 animate-pulse mt-2">
                      <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-1/2 mx-auto"></div>
                      <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-3/4 mx-auto"></div>
                  </div>
              ) : (
                  <>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{userData?.name || "User"}</h2>
                      <div className="flex items-center justify-center gap-1.5 text-gray-500 dark:text-gray-400 text-xs mt-1">
                          <Mail className="w-3 h-3" />
                          <span>{userData?.email}</span>
                      </div>
                  </>
              )}

              <div className="mt-8 space-y-3">
                  {userData?.role === 'admin' && (
                        <button 
                          onClick={() => {
                              navigate('/manage-users'); 
                              onClose(); 
                          }}
                          className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition active:scale-95 shadow-lg shadow-blue-500/20"
                        >
                          <Users className="w-5 h-5" />
                          {t.manage_users}
                      </button>
                    )}

                  <button 
                      onClick={() => setIsSwitchConfirmOpen(true)}
                      className="w-full py-3.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold rounded-2xl flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700 transition active:scale-95 shadow-sm"
                  >
                      <LogOut className="w-5 h-5" />
                      {t.switch_account || "Ganti Akun"}
                  </button>
              </div>

              {userData?.role === 'admin' && (
                  <p className="text-[10px] text-gray-400 mt-6 flex items-center justify-center gap-1">
                      <Shield className="w-3 h-3" />
                      {t.admin_mode_active}
                  </p>
              )}
          </div>
        </div>
      </div>

      <ConfirmModal 
        isOpen={isSwitchConfirmOpen}
        onClose={() => setIsSwitchConfirmOpen(false)}
        onConfirm={performSwitchAccount}
        title={t.switch_account || "Ganti Akun"}
        message={t.switch_account_msg || "Anda akan keluar dari akun ini."}
        confirmText={t.yes_switch || "Ya, Ganti"}
      />
    </>
  );
}