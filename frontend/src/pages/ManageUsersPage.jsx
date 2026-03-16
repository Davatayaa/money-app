import { useState, useEffect } from 'react';
import api from '@/services/api';
import { 
  Check, Ban, Trash2, Clock, Users, ArrowLeft, 
  RefreshCw, ShieldAlert, Smartphone, Monitor, 
  Send, BellRing, X, CalendarClock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '@/components/ConfirmModal';
import { useLanguage } from '@/contexts/LanguageContext';

import ScheduleModal from '@/components/ScheduleModal'; 

const SendNotificationModal = ({ isOpen, onClose, targetUser, t }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setBody('');
    }
  }, [isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!title || !body) return toast.error(t.notif_error_empty);

    setLoading(true);
    try {
      const payload = {
        user_id: targetUser ? targetUser.id : 0,
        title: title,
        body: body,
      };

      await api.post('/admin/notifications/send', payload);
      
      const successMsg = targetUser 
        ? `${t.notif_sent_to} ${targetUser.name}` 
        : t.notif_broadcast_success;
      
      toast.success(successMsg);
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(t.notif_error_failed);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all scale-100">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                {targetUser ? <Send className="w-5 h-5 text-blue-500" /> : <BellRing className="w-5 h-5 text-orange-500" />}
                {targetUser 
                  ? `${t.notif_send_to} ${targetUser.name}` 
                  : t.notif_broadcast_title}
             </h3>
             <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                <X className="w-5 h-5 text-gray-500" />
             </button>
          </div>
          
          <form onSubmit={handleSend} className="space-y-4">
            <div>
                <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1 tracking-widest uppercase">
                  {t.notif_label_title}
                </label>
                <input 
                    type="text" 
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder={t.notif_placeholder_title}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />
            </div>
            <div>
                <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1 tracking-widest uppercase">
                  {t.notif_label_message}
                </label>
                <textarea 
                    rows="4"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition resize-none"
                    placeholder={t.notif_placeholder_message}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                />
            </div>

            <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold transition text-xs">
                    {t.cancel}
                </button>
                <button 
                    type="submit" 
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/30 transition disabled:opacity-50 flex justify-center items-center gap-2 text-xs"
                >
                    {loading ? t.sending : (
                        <><Send className="w-4 h-4" /> {t.send}</>
                    )}
                </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default function ManageUsersPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('USERS');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState(null);
  
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [selectedUserForNotif, setSelectedUserForNotif] = useState(null);

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchUsers(), fetchLogs()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchLogs = async () => {
    try {
      const res = await api.get('/admin/logs');
      setLogs(res.data.data || []);
    } catch (err) { console.error(err); }
  };

  const handleStatusChange = async (userId, newStatus) => {
    try {
      await api.put(`/admin/users/${userId}/status`, { status: newStatus });
      toast.success(newStatus === 'active' ? t.user_activated : t.user_blocked);
      fetchUsers();
    } catch (err) { toast.error("Failed to update status"); }
  };

  const handleDeleteUser = (user) => {
    setIdToDelete(user.id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!idToDelete) return;
    try {
        await api.delete(`/admin/users/${idToDelete}`);
        toast.success(t.user_deleted);
        fetchUsers(); 
    } catch (err) {
        toast.error("Failed to delete user");
    } finally {
        setDeleteModalOpen(false);
        setIdToDelete(null);
    }
  };

  const isUserOnline = (user) => {
     if (user.last_login_at) {
        const lastLoginDate = new Date(user.last_login_at);
        const now = new Date();
        const diffMinutes = (now - lastLoginDate) / 1000 / 60;
        return diffMinutes < 60;
    }
    return false;
  };

  const getDeviceIcon = (userAgent) => {
    if (!userAgent) return <Monitor className="w-3 h-3"/>;
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
        return <Smartphone className="w-3 h-3"/>;
    }
    return <Monitor className="w-3 h-3"/>;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 shadow-sm pt-14">
        <div className="max-w-5xl mx-auto px-4 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
                onClick={() => navigate('/', { state: { activeTab: 'more', openProfile: true } })} 
                className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
            >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <h1 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-blue-600" /> {t.manage_users_title}
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            
            <button 
                onClick={() => setIsScheduleModalOpen(true)}
                className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 transition border border-purple-100 dark:border-purple-800/50"
                title="Atur Jadwal Notifikasi"
            >
                <CalendarClock className="w-5 h-5" />
            </button>

            <button 
                onClick={() => { setSelectedUserForNotif(null); setIsNotifModalOpen(true); }}
                className="p-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-xl hover:bg-orange-100 transition border border-orange-100 dark:border-orange-800/50"
                title={t.btn_broadcast}
            >
                <BellRing className="w-5 h-5" />
            </button>

            <button 
                onClick={fetchData} 
                className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 transition disabled:opacity-50 border border-blue-100 dark:border-blue-800/50"
            >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-6">
        <div className="flex p-1 bg-gray-200 dark:bg-gray-700/50 rounded-xl w-full mb-6">
          <button onClick={() => setActiveTab('USERS')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${activeTab === 'USERS' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
            <Users className="w-4 h-4"/> {t.tab_users}
          </button>
          <button onClick={() => setActiveTab('LOGS')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${activeTab === 'LOGS' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
            <Clock className="w-4 h-4"/> {t.tab_logs}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden min-h-[400px]">
          {activeTab === 'USERS' ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {users.map(user => {
                const isOnline = isUserOnline(user);
                return (
                <div key={user.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition gap-4">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <img 
                              src={user.avatar_url && user.avatar_url.length > 10 ? user.avatar_url : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`}
                              onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`; }}
                              className="w-12 h-12 rounded-full border-2 border-gray-100 dark:border-gray-600 shadow-sm object-cover bg-gray-100" 
                              alt={user.name} 
                            />
                            <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-white dark:border-gray-800 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-300'}`}></div>
                        </div>

                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-800 dark:text-white text-sm flex items-center gap-2 truncate">
                                {user.name} 
                                {user.role === 'admin' && <span className="text-[9px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-md font-black tracking-wide">ADMIN</span>}
                            </h4>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            
                            <div className="mt-1 flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${user.status === 'active' ? 'bg-green-100 text-green-700' : user.status === 'blocked' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {user.status === 'active' ? t.status_active : user.status === 'blocked' ? t.status_blocked : t.status_pending}
                                </span>
                                {isOnline && <span className="text-[9px] text-green-600 font-medium animate-pulse">● {t.status_online}</span>}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 justify-end mt-2 sm:mt-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100 dark:border-gray-700">
                        <button onClick={() => { setSelectedUserForNotif(user); setIsNotifModalOpen(true); }} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition border border-blue-100" title={t.btn_message}>
                            <Send className="w-4 h-4"/>
                        </button>

                        {user.role !== 'admin' && (
                          <>
                            {user.status === 'blocked' ? (
                                <button onClick={() => handleStatusChange(user.id, 'active')} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition border border-green-100" title={t.btn_unblock}><Check className="w-4 h-4"/></button>
                            ) : (
                                user.status !== 'pending' && (
                                <button onClick={() => handleStatusChange(user.id, 'blocked')} className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition border border-orange-100" title={t.btn_block}><Ban className="w-4 h-4"/></button>
                                )
                            )}
                            {user.status === 'pending' && (
                                <button onClick={() => handleStatusChange(user.id, 'active')} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition border border-blue-100" title={t.btn_approve}><Check className="w-4 h-4"/></button>
                            )}
                            <button onClick={() => handleDeleteUser(user)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition border border-red-100" title={t.btn_delete}><Trash2 className="w-4 h-4"/></button>
                          </>
                        )}
                    </div>
                </div>
              )})}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {logs.length > 0 ? logs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition group">
                   <div className="flex justify-between items-start mb-1">
                      <div>
                         <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{log.name || t.label_user}</p>
                         <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{log.email || log.user_email || t.email_unavailable}</p>
                      </div>
                      <div className="text-right">
                         <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            {new Date(log.login_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                         </span>
                         <p className="text-[9px] text-gray-400 mt-1">
                            {new Date(log.login_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}
                         </p>
                      </div>
                   </div>
                   
                   <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-1.5 overflow-hidden flex-1">
                         {getDeviceIcon(log.user_agent)}
                         <span className="truncate" title={log.user_agent}>{log.user_agent}</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-[10px] bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600 shadow-sm text-gray-600 dark:text-gray-300">
                         IP: {log.ip_address}
                      </div>
                   </div>
                </div>
              )) : (
                <div className="p-8 text-center text-gray-400 text-xs">{t.empty_logs}</div>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title={t.confirm_delete_user_title}
        message={t.confirm_delete_user_msg}
        cancelText={t.cancel}
        confirmText={t.yes_delete}
      />

      <SendNotificationModal 
        isOpen={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
        targetUser={selectedUserForNotif}
        t={t} 
      />

      <ScheduleModal 
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
      />

    </div>
  );
}