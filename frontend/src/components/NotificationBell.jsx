import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCircle, AlertCircle, Info, ChevronDown, ChevronUp, CheckCheck, X } from 'lucide-react';
import api from '@/services/api';
import { useLanguage } from '@/contexts/LanguageContext';

const LOCALE_TEXT = {
  id: {
    title: "Notifikasi",
    new: "baru",
    readAll: "Baca Semua",
    refresh: "Refresh",
    emptyTitle: "Tidak ada notifikasi",
    emptyDesc: "Semua aman terkendali, istirahatlah!",
    footer: "Menampilkan 20 pesan terakhir",
    today: "Hari Ini",
    yesterday: "Kemarin"
  },
  en: {
    title: "Notifications",
    new: "new",
    readAll: "Read All",
    refresh: "Refresh",
    emptyTitle: "No notifications",
    emptyDesc: "Everything is clear, take a break!",
    footer: "Showing last 20 messages",
    today: "Today",
    yesterday: "Yesterday"
  }
};

const getGroupLabel = (dateString, lang) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const n = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const diffTime = n - d;
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  const txt = LOCALE_TEXT[lang] || LOCALE_TEXT.id;

  if (diffDays === 0) return txt.today;
  if (diffDays === 1) return txt.yesterday;
  
  const localeCode = lang === 'id' ? 'id-ID' : 'en-US';
  return date.toLocaleDateString(localeCode, { day: 'numeric', month: 'long', year: 'numeric' });
};

const NotificationItem = ({ notif, onMarkRead, lang }) => {
  const [expanded, setExpanded] = useState(false);
  const localeCode = lang === 'id' ? 'id-ID' : 'en-US';

  const handleClick = (e) => {
    e.stopPropagation();
    setExpanded(!expanded);
    if (!notif.is_read) {
        onMarkRead(notif);
    }
  };

  return (
    <div 
      onClick={handleClick}
      className={`group relative px-4 py-3 border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-all duration-200
      ${!notif.is_read ? 'bg-blue-50/60 dark:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-1">
          {notif.type === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
          {notif.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
          {(!['success', 'error'].includes(notif.type)) && <Info className="w-5 h-5 text-blue-500" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-0.5">
             <p className={`text-sm leading-tight pr-2 ${!notif.is_read ? 'font-bold text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>
               {notif.title}
             </p>
             <span className="text-[10px] text-gray-400 whitespace-nowrap font-medium mt-0.5">
               {new Date(notif.created_at).toLocaleString(localeCode, { hour: '2-digit', minute:'2-digit' })}
             </span>
          </div>

          <div className={`text-xs text-gray-500 dark:text-gray-400 leading-relaxed transition-all duration-300 overflow-hidden ${expanded ? 'max-h-60' : 'max-h-10 line-clamp-2'}`}>
            {notif.body}
          </div>
          
          {notif.body && notif.body.length > 60 && (
            <div className="flex justify-center mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
               {expanded ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
            </div>
          )}
        </div>

        {!notif.is_read && (
          <div className="absolute top-4 right-2">
             <div className="w-2 h-2 bg-blue-600 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.6)] animate-pulse"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function NotificationBell() {
  const { language } = useLanguage();
  const t = LOCALE_TEXT[language] || LOCALE_TEXT.id;

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const btnRef = useRef(null);
  const dropdownRef = useRef(null);
  
  const [dropdownStyle, setDropdownStyle] = useState({});

  const fetchNotifications = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const response = await api.get('/notifications');
      const data = response.data.data || [];
      
      const sortedData = data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      setNotifications(sortedData);
      setUnreadCount(sortedData.filter(n => !n.is_read).length);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    
    const handleRefreshSignal = () => fetchNotifications(true);
    window.addEventListener('REFRESH_NOTIF', handleRefreshSignal);
    
    const interval = setInterval(() => fetchNotifications(true), 60000);
    
    return () => {
        window.removeEventListener('REFRESH_NOTIF', handleRefreshSignal);
        clearInterval(interval);
    };
  }, []);

  const groupedNotifications = useMemo(() => {
    const groups = {};
    notifications.forEach(notif => {
      const label = getGroupLabel(notif.created_at, language);
      if (!groups[label]) groups[label] = [];
      groups[label].push(notif);
    });
    return Object.keys(groups).map(label => ({ label, items: groups[label] }));
  }, [notifications, language]);

  const markAsRead = async (notif) => {
    if (notif.is_read) return;

    const updated = notifications.map(n => n.id === notif.id ? { ...n, is_read: true } : n);
    setNotifications(updated);
    setUnreadCount(prev => Math.max(0, prev - 1));

    try {
      await api.put(`/notifications/${notif.id}/read`);
    } catch (error) {
      console.error("Failed to mark read");
    }
  };

  const handleMarkAllRead = async () => {
    const unreadItems = notifications.filter(n => !n.is_read);
    if (unreadItems.length === 0) return;

    // Optimistic Update
    const updated = notifications.map(n => ({ ...n, is_read: true }));
    setNotifications(updated);
    setUnreadCount(0);

    try {
      await Promise.all(unreadItems.map(n => api.put(`/notifications/${n.id}/read`)));
    } catch (error) {
      console.error("Failed to mark all read");
      fetchNotifications(true);
    }
  };

  const calculatePosition = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
        setDropdownStyle({
            position: 'fixed',
            top: '80px',
            right: '16px',
            left: '16px',
            width: 'auto',
            maxWidth: '100%',
            transform: 'none'
        });
    } else {
        setDropdownStyle({
            position: 'fixed',
            top: `${rect.bottom + 12}px`,
            right: `${window.innerWidth - rect.right}px`,
            left: 'auto',
            width: '340px',
            transform: 'none'
        });
    }
  };

  const toggleDropdown = () => {
    if (!isOpen) {
        fetchNotifications(true);
        calculatePosition();
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (isOpen) {
        window.addEventListener('resize', calculatePosition);
        window.addEventListener('scroll', calculatePosition, true);
    }
    return () => {
        window.removeEventListener('resize', calculatePosition);
        window.removeEventListener('scroll', calculatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
        if (
            dropdownRef.current && !dropdownRef.current.contains(event.target) &&
            btnRef.current && !btnRef.current.contains(event.target)
        ) {
            setIsOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  return (
    <>
      <button 
        ref={btnRef} 
        onClick={toggleDropdown} 
        className={`p-2 rounded-full transition-all duration-200 relative text-white ring-1 shadow-lg z-50 active:scale-95
        ${isOpen ? 'bg-white/30 ring-white/40' : 'bg-white/20 hover:bg-white/30 ring-white/20 backdrop-blur-md'}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-blue-600 shadow-sm animate-bounce">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && createPortal(
        <>
            <div 
                className="fixed inset-0 bg-black/20 z-[9998] md:hidden backdrop-blur-[1px] transition-opacity"
                onClick={() => setIsOpen(false)}
            ></div>

            <div 
                ref={dropdownRef}
                style={dropdownStyle}
                className="z-[9999] animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 origin-top-right"
            >
                <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 flex flex-col overflow-hidden max-h-[70vh] md:max-h-[60vh]">
                    
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/80 dark:bg-gray-800/80">
                        <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm flex items-center gap-2">
                            {t.title} 
                            {unreadCount > 0 && <span className="bg-blue-100 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{unreadCount} {t.new}</span>}
                        </h3>
                        
                        <div className="flex gap-1">
                            {unreadCount > 0 && (
                                <button 
                                    onClick={handleMarkAllRead} 
                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition"
                                    title={t.readAll}
                                >
                                    <CheckCheck className="w-4 h-4" />
                                </button>
                            )}
                            <button 
                                onClick={() => setIsOpen(false)} 
                                className="md:hidden p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent flex-1">
                        {loading ? (
                            <div className="p-8 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
                                <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></span>
                                Loading...
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="py-12 px-6 text-center text-gray-400 flex flex-col items-center justify-center h-full">
                                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full mb-3">
                                    <Bell className="w-6 h-6 opacity-30" />
                                </div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{t.emptyTitle}</p>
                                <p className="text-xs mt-1 opacity-60">{t.emptyDesc}</p>
                            </div>
                        ) : (
                            <div className="pb-2">
                                {groupedNotifications.map((group) => (
                                    <div key={group.label}>
                                        <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-4 py-1.5 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider shadow-sm">
                                            {group.label}
                                        </div>
                                        <div className="divide-y divide-gray-50 dark:divide-gray-800">
                                            {group.items.map((notif) => (
                                                <NotificationItem key={notif.id} notif={notif} onMarkRead={markAsRead} lang={language} />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {notifications.length > 0 && (
                        <div className="py-2 bg-gray-50/90 dark:bg-gray-800/90 text-center border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 font-medium shrink-0">
                            {t.footer}
                        </div>
                    )}
                </div>
            </div>
        </>,
        document.body
      )}
    </>
  );
}