import { useEffect, useState, useMemo, useRef } from 'react';
import api from '@/services/api';
import { 
  ArrowUpCircle, ArrowDownCircle, Plus, Moon, Sun, 
  Receipt, PieChart as PieChartIcon, MoreHorizontal, BellRing,
  ChevronLeft, ChevronRight, X, Wallet, ChevronUp, ChevronDown, 
  Loader2, Search, Eye, EyeOff 
} from 'lucide-react'; 
import toast, { Toaster } from 'react-hot-toast';

import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';

import { requestForToken, onMessageListener } from '@/services/firebase';

import WalletManagerModal from '@/components/WalletManagerModal';
import ConfirmModal from '@/components/ConfirmModal'; 
import ProfileModal from '@/components/ProfileModal'; 
import TransactionsPage from '@/pages/TransactionsPage';
import StatsPage from '@/pages/StatsPage';
import MorePage from '@/pages/MorePage';
import LoginPage from '@/pages/LoginPage'; 
import ManageUsersPage from '@/pages/ManageUsersPage';
import NotificationBell from '@/components/NotificationBell'; 
import AIFloatingButton from '@/components/AIFloatingButton';
import GlobalLoader from '@/components/GlobalLoader'; 
import AddTransaction from '@/pages/AddTransactionPage';
import { PrivacyProvider, usePrivacy } from '@/contexts/PrivacyContext';

function DashboardContent() {
  const { t, language } = useLanguage();
  const { darkMode, toggleTheme } = useTheme();
  const { token, setToken } = useAuth(); 
  const location = useLocation(); 

  const [activeTab, setActiveTab] = useState('transactions'); 
  const [wallets, setWallets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(true);
  const [customDeleteMessage, setCustomDeleteMessage] = useState("");
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null); 
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState(null);            
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(Notification.permission);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false); 
  const [pickerYear, setPickerYear] = useState(currentDate.getFullYear()); 

  const navigate = useNavigate();

  const { privacyMode, togglePrivacy } = usePrivacy();

  const formatPrivacy = (amount) => {
      if (privacyMode) return "Rp ••••••••";
      return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  const lastMessageId = useRef(null);

  const truncateText = (text, maxLength) => {
    if (!text) return "";
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  };

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then((reg) => console.log("✅ SW Registered", reg.scope))
        .catch((err) => console.error("❌ SW Fail", err));
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onMessageListener((payload) => {
      if (payload.messageId === lastMessageId.current) return;
      lastMessageId.current = payload.messageId;
      window.dispatchEvent(new Event('REFRESH_NOTIF'));
      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-enter opacity-100 translate-y-0' : 'animate-leave opacity-0 -translate-y-2'} max-w-sm w-full bg-white dark:bg-gray-800 shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black/5 dark:ring-white/10 overflow-hidden my-2 transition-all duration-500 ease-in-out transform`}>
           <div className="flex-1 w-0 p-4 flex items-start gap-3">
              <div className="flex-shrink-0">
                 <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shadow-inner">
                    <p className="text-xl">🔔</p>
                 </div>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                 <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{payload.notification?.title || "Info"}</p>
                 <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-snug break-words">{truncateText(payload.notification?.body, 60)}</p>
              </div>
           </div>
           <div className="w-[1px] bg-gray-100 dark:bg-gray-700 my-2"></div>
           <div className="flex">
              <button onClick={() => toast.dismiss(t.id)} className="w-full border border-transparent rounded-none p-4 flex items-center justify-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 focus:outline-none hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">{t.btnClose || "Close"}</button>
           </div>
        </div>
      ), { duration: 5000, position: "top-center", id: payload.messageId });
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, [token]);

  const handleEnableNotif = () => {
    if (!("Notification" in window)) return alert("Browser tidak support.");
    if (Notification.permission === 'denied') return alert("Izin ditolak. Reset izin di pengaturan browser.");
    Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
            requestForToken().then(() => { setPermissionStatus('granted'); alert("Notifikasi aktif!"); });
        }
    });
  };

  useEffect(() => {
    if (location.state) {
        if (location.state.activeTab) setActiveTab(location.state.activeTab);
        if (location.state.openProfile) setIsProfileOpen(true);
        window.history.replaceState({}, document.title);
    }
  }, [location]);

  const fetchData = async () => {
    try {
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      const [resWallets, resTrans] = await Promise.all([
          api.get('/wallets', { params: { month, year } }), 
          api.get('/transactions', { params: { month, year } }) 
      ]);

      setWallets(resWallets.data.data || []);
      setTransactions(resTrans.data.data || []);
      
    } catch (error) { 
        if(error.response?.status === 401) { 
          setToken(null); 
          localStorage.removeItem('token'); 
        }
    } finally { setLoading(false); }
  };

  useEffect(() => { if (token) fetchData(); }, [token, currentDate]);

  const goToPrevMonth = () => setCurrentDate(prev => { const d = new Date(prev); d.setMonth(prev.getMonth() - 1); return d; });
  const goToNextMonth = () => setCurrentDate(prev => { const d = new Date(prev); d.setMonth(prev.getMonth() + 1); return d; });

  const getMonthNames = () => {
    const locale = language === 'id' ? 'id-ID' : 'en-US';
    return Array.from({ length: 12 }, (_, i) => new Date(0, i).toLocaleString(locale, { month: 'short' }));
  };

  const handleSelectMonth = (monthIndex) => {
    const newDate = new Date(pickerYear, monthIndex, 1);
    setCurrentDate(newDate);
    setIsDatePickerOpen(false);
  };

  const filteredStatsTransactions = useMemo(() => {
    return transactions.filter(trx => {
      const catName = (trx.category_name || '').toLowerCase();
      const desc = (trx.description || '').toLowerCase();
      
      const isExcluded = catName.includes('transfer') || 
                        catName.includes('pindah dana') ||
                        catName.includes('balance adjustment') || 
                        desc.includes('balance adjustment') ||     
                        desc.includes('transfer ke wallet') || 
                        desc.includes('terima dari wallet');

      return !isExcluded; 
    });
  }, [transactions]);

  const monthlyStats = useMemo(() => {
    return filteredStatsTransactions.reduce((acc, curr) => {
      if (curr.type === 'EXPENSE') acc.expense += curr.amount;
      else acc.income += curr.amount;
      return acc;
    }, { income: 0, expense: 0 });
  }, [filteredStatsTransactions]);

  const netBalance = useMemo(() => {
    return wallets.reduce((acc, curr) => acc + (curr.monthly_flow || 0), 0);
  }, [wallets]);

  const allTransactionsForMonth = useMemo(() => {
      return transactions; 
  }, [transactions]);

  const searchedTransactions = useMemo(() => {
    if (!searchQuery) return allTransactionsForMonth;
    
    const lowerQuery = searchQuery.toLowerCase();
    return allTransactionsForMonth.filter(item => 
        (item.description && item.description.toLowerCase().includes(lowerQuery)) ||
        (item.category_name && item.category_name.toLowerCase().includes(lowerQuery)) ||
        (item.amount && item.amount.toString().includes(lowerQuery))
    );
  }, [allTransactionsForMonth, searchQuery]);

  const walletsWithMonthlyStats = useMemo(() => {
    return wallets; 
  }, [wallets]);

  const groupedTransactions = useMemo(() => {
    const groups = {};
    searchedTransactions.forEach(trx => {
        const dateKey = new Date(trx.date).toDateString(); 
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(trx);
    });
    return Object.keys(groups).map(date => ({ date, items: groups[date] }));
  }, [searchedTransactions]);

  useEffect(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
  }, [activeTab]);

  const handleSwipeTrigger = (id) => {
    const trx = transactions.find(t => t.id === id);
    
    if (trx) {
        const desc = (trx.description || '').toLowerCase();
        const cat = (trx.category_name || '').toLowerCase();

        const isTransfer = 
            desc.includes('transfer') || 
            desc.includes('terima dari') || 
            desc.includes('pindah dana') ||
            cat.includes('transfer');

        const isAdjustment = 
            desc.includes('balance adjustment') || 
            cat.includes('balance adjustment') || 
            cat.includes('koreksi');

        if (isAdjustment) {
            setCustomDeleteMessage(t.alertDeleteAdjustment || "Menghapus penyesuaian ini akan membatalkan koreksi saldo.");
        } else if (isTransfer) {
            setCustomDeleteMessage(t.alertDeleteTransfer || "⚠️ Hapus transfer ini? Sistem akan OTOMATIS menghapus pasangannya di dompet lain.");
        } else {
            setCustomDeleteMessage(t.alertDeleteDefault || "Hapus transaksi ini?");
        }
    } else {
        setCustomDeleteMessage("Hapus transaksi ini?");
    }

    setIdToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!idToDelete) return;
    try { 
        await api.delete(`/transactions/${idToDelete}`); 
        toast.success(t.trxDeleted || "Transaksi dihapus"); 
        fetchData(); 
        setDeleteModalOpen(false); 
    } catch (error) { 
        toast.error("Gagal hapus"); 
    }
  };

  const handleTransactionClick = (trx) => {
    const desc = (trx.description || '').toLowerCase();
    const cat = (trx.category_name || '').toLowerCase();

    const isTransfer = 
        desc.includes('transfer') || 
        desc.includes('terima dari') || 
        desc.includes('pindah dana') ||
        cat.includes('transfer');

    if (isTransfer) {
        toast.error(t.noEditTransfer || "Transaksi transfer tidak bisa diedit. Silakan hapus dan buat ulang", {
            icon: '🔒',
            style: {
                background: '#ef4444',
                color: '#fff',
            },
        });
        return; 
    }

    navigate('/add-transaction', { state: { transaction: trx } });
  };

  const locale = language === 'id' ? 'id-ID' : 'en-US';
  const monthLabel = currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const shortMonth = currentDate.toLocaleDateString(locale, { month: 'short' });

  if (loading && !transactions.length && !wallets.length) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 animate-in fade-in duration-500">
        <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-500 animate-spin mb-4" />
        <div className="flex flex-col items-center gap-1 text-center px-4">
           <h1 className="text-lg font-bold text-gray-800 dark:text-white tracking-tight">{t.appName || "Money App"}</h1>
           <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">Siap-siap jadi kaya... 🚀</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full max-w-3xl mx-auto bg-gray-50 dark:bg-gray-900 shadow-2xl overflow-hidden flex flex-col">
        {activeTab !== 'more' && (
          <div className="flex-none z-20 shadow-sm" style={{ background: darkMode ? 'linear-gradient(to bottom, #1e40af 50%, #111827 50%)' : 'linear-gradient(to bottom, #2563eb 50%, #f9fafb 50%)' }}>
            <div className="bg-blue-600 dark:bg-blue-800 px-6 pt-14 pb-0 text-white rounded-b-3xl shadow-lg relative overflow-hidden z-30 transition-all duration-500 ease-in-out">
              <Wallet className="absolute -right-10 -bottom-16 w-80 h-80 text-white opacity-10 -rotate-12 pointer-events-none" strokeWidth={1} />
              <div className="absolute top-[-20px] right-[-20px] w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="relative z-10">
                  {activeTab === 'transactions' && (
                    <div className="flex items-center justify-between mb-4">
                      <h1 className="text-xl font-bold">{t.appName}</h1>
                      <div className="flex items-center gap-2">
                        <button onClick={toggleTheme} className="p-2 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 transition text-white">
                          {darkMode ? <Sun className="w-5 h-5 text-yellow-300" /> : <Moon className="w-5 h-5 text-white" />}
                        </button>
                        <NotificationBell />
                        <button onClick={() => { setIsSearchOpen(!isSearchOpen); if (!isSearchOpen) setSearchQuery(''); }} className={`p-2 rounded-full hover:bg-white/20 transition text-white ${isSearchOpen ? 'bg-white/20' : 'bg-white/10 backdrop-blur-md'}`}>
                            {isSearchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'transactions' && (
                      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isSearchOpen ? 'max-h-20 opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0'}`}>
                            <div className="bg-white/10 backdrop-blur-md p-1 rounded-xl flex items-center border border-white/20">
                              <Search className="w-4 h-4 text-white/60 ml-3" />
                              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t.search_placeholder || "Cari transaksi..."} className="w-full bg-transparent border-none outline-none text-white placeholder-white/50 text-sm px-3 py-2" autoFocus={isSearchOpen} />
                              {searchQuery && ( <button onClick={() => setSearchQuery('')} className="p-1 hover:bg-white/10 rounded-full mr-1"><X className="w-3 h-3 text-white/80" /></button> )}
                            </div>
                      </div>
                  )}

                  <div className={`flex justify-center ${activeTab === 'stats' ? 'pb-6 pt-2' : 'mb-2'}`}>
                    <div className="flex items-center bg-white/20 backdrop-blur-sm rounded-full px-1 py-1 border border-white/10 shadow-sm">
                        <button onClick={goToPrevMonth} className="p-1 hover:bg-white/20 rounded-full transition"><ChevronLeft className="w-4 h-4 text-white" /></button>
                        <button onClick={() => { setPickerYear(currentDate.getFullYear()); setIsDatePickerOpen(true); }} className="text-xs font-bold text-white px-4 min-w-[100px] text-center hover:bg-white/10 rounded-lg transition py-1">
                            {monthLabel}
                        </button>
                        <button onClick={goToNextMonth} className="p-1 hover:bg-white/20 rounded-full transition"><ChevronRight className="w-4 h-4 text-white" /></button>
                    </div>
                  </div>

                  {activeTab === 'transactions' && (
                    <>
                      <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isHeaderExpanded ? 'max-h-[500px] opacity-100 mt-6' : 'max-h-0 opacity-0 mt-0'}`}>
                        <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/20 mb-6 relative overflow-hidden group">
                            <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-white/5 rounded-full blur-xl pointer-events-none"></div>
                            <button onClick={togglePrivacy} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition z-20">
                                {privacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <p className="text-blue-100 text-sm mb-1 font-medium pr-10">
                            {privacyMode || netBalance >= 0 ? (t.netBalance || "Sisa Uang") : (t.deficit || "Defisit")} {shortMonth}
                            </p>
                            <h2 className="text-4xl font-bold tracking-tight flex items-center gap-2">
                            {formatPrivacy(Math.abs(netBalance))}
                            {!privacyMode && netBalance < 0 && (<span className="text-red-200 bg-red-600/40 text-xs px-2 py-1 rounded-lg border border-red-400/30 animate-pulse">!</span>)}
                            </h2>
                            <p className="text-[10px] text-blue-200 mt-2 opacity-80">
                            {netBalance >= 0 ? (t.status_safe || "Keuangan aman terkendali 👍") : (t.status_danger || "Pengeluaran lebih besar dari pemasukan ⚠️")}
                            </p>
                      </div>

                      <div className="flex gap-4">
                        <div className="flex-1 bg-green-500/20 backdrop-blur-sm p-3 rounded-xl flex items-center gap-3 border border-green-400/20">
                            <div className="bg-green-400/20 p-2 rounded-full"><ArrowUpCircle className="w-6 h-6 text-green-300" /></div>
                            <div><p className="text-[10px] text-green-100 uppercase tracking-wider">{t.income}</p><p className="font-bold text-sm">{formatPrivacy(monthlyStats.income)}</p></div>
                        </div>
                        <div className="flex-1 bg-red-500/20 backdrop-blur-sm p-3 rounded-xl flex items-center gap-3 border border-red-400/20">
                            <div className="bg-red-400/20 p-2 rounded-full"><ArrowDownCircle className="w-6 h-6 text-red-300" /></div>
                            <div><p className="text-[10px] text-red-100 uppercase tracking-wider">{t.expense}</p><p className="font-bold text-sm">{formatPrivacy(monthlyStats.expense)}</p></div>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-center mt-2">
                          <button onClick={() => setIsHeaderExpanded(!isHeaderExpanded)} className="p-1 rounded-full hover:bg-white/10 transition text-white/70 hover:text-white active:scale-95">
                              {isHeaderExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                    </div>
                  </>
                  )}
              </div>
            </div>
          </div>
        )}

        {isDatePickerOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white dark:bg-gray-800 w-full max-w-xs rounded-2xl shadow-2xl p-4 animate-in zoom-in-95">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-800 dark:text-white">{t.period_date || "Pilih Periode"}</h3>
                        <button onClick={() => setIsDatePickerOpen(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
                    </div>
                    <div className="flex justify-between items-center bg-gray-100 dark:bg-gray-700 rounded-xl p-2 mb-4">
                        <button onClick={() => setPickerYear(p => p - 1)} className="p-2 hover:bg-white dark:hover:bg-gray-600 rounded-lg shadow-sm transition"><ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" /></button>
                        <span className="text-xl font-bold text-gray-800 dark:text-white">{pickerYear}</span>
                        <button onClick={() => setPickerYear(p => p + 1)} className="p-2 hover:bg-white dark:hover:bg-gray-600 rounded-lg shadow-sm transition"><ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {getMonthNames().map((mName, idx) => (
                            <button key={idx} onClick={() => handleSelectMonth(idx)} className={`py-3 rounded-xl text-sm font-bold transition border ${currentDate.getMonth() === idx && currentDate.getFullYear() === pickerYear ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-105' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-gray-700 hover:border-blue-500 hover:text-blue-500'}`}>{mName}</button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        <div className="flex-1 overflow-y-auto scroll-smooth">
            {activeTab === 'transactions' && permissionStatus !== 'granted' && (
               <div className="px-6 mt-4 mb-2">
                 <button onClick={handleEnableNotif} className="w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-xl flex items-center justify-between shadow-sm active:scale-95 transition">
                   <div className="flex items-center gap-3">
                     <div className="bg-blue-600 p-2 rounded-full text-white"><BellRing size={16} /></div>
                     <div className="text-left"><p className="text-sm font-bold text-blue-800 dark:text-blue-200">{t.headButtonNotfication || "Aktifkan Notifikasi"}</p><p className="text-[10px] text-blue-600 dark:text-blue-300">{t.descButtonNotfication || "Agar tau info apapun dari Money App"}</p></div>
                   </div>
                   <span className="text-xs font-bold bg-blue-600 text-white px-3 py-1.5 rounded-lg">{t.buttonNotfication || "Aktifkan"}</span>
                 </button>
               </div>
            )}
            
            {activeTab === 'transactions' && (
              <TransactionsPage 
                walletsWithMonthlyStats={walletsWithMonthlyStats} 
                shortMonth={shortMonth} 
                monthLabel={monthLabel} 
                groupedTransactions={groupedTransactions} 
                wallets={wallets} 
                onSwipe={handleSwipeTrigger} 
                onClickItem={handleTransactionClick} 
                onOpenWalletModal={() => setIsWalletModalOpen(true)}
              />
            )}
            
            {activeTab === 'stats' && (
              <StatsPage 
                allTransactions={transactions} 
                wallets={wallets} 
                currentDate={currentDate}
                onOpenWalletModal={() => setIsWalletModalOpen(true)}
              />
            )}
            {activeTab === 'more' && <MorePage onUpdateData={fetchData} />}
        </div>

        {activeTab === 'transactions' && (
           <button onClick={() => navigate('/add-transaction')} 
           className="absolute bottom-24 right-6 bg-blue-600 dark:bg-blue-500 text-white w-14 h-14 rounded-full shadow-xl hover:bg-blue-700 dark:hover:bg-blue-600 active:scale-95 transition flex items-center justify-center z-40"><Plus className="w-8 h-8" /></button>
        )}

        <>
            <div className="fixed left-0 right-0 h-24 -bottom-8 z-40 transition-colors duration-300 w-full max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-t-3xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_6px_-1px_rgba(255,255,255,0.05)]"></div>
            <div className="fixed bottom-0 left-0 right-0 z-50 w-full max-w-3xl mx-auto">
                <div className="flex justify-around items-end pt-3 pb-1 sm:pb-4">
                  <button onClick={() => { setActiveTab('transactions'); if (navigator.vibrate) navigator.vibrate(10); }} className={`flex flex-col items-center justify-center w-full pb-1 transition active:scale-90 ${activeTab === 'transactions' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600'}`}>
                    <Receipt className={`w-6 h-6 mb-0.5 ${activeTab === 'transactions' ? 'fill-blue-100 dark:fill-blue-900/30' : ''}`} />
                    <span className="text-[10px] font-bold leading-none">{t.menu_trans}</span>
                  </button>
                  <button onClick={() => { setActiveTab('stats'); if (navigator.vibrate) navigator.vibrate(10); }} className={`flex flex-col items-center justify-center w-full pb-1 transition active:scale-90 ${activeTab === 'stats' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600'}`}>
                    <PieChartIcon className={`w-6 h-6 mb-0.5 ${activeTab === 'stats' ? 'fill-blue-100 dark:fill-blue-900/30' : ''}`} />
                    <span className="text-[10px] font-bold leading-none">{t.menu_stats}</span>
                  </button>
                  <button onClick={() => { setActiveTab('more'); if (navigator.vibrate) navigator.vibrate(10); }} className={`flex flex-col items-center justify-center w-full pb-1 transition active:scale-90 ${activeTab === 'more' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600'}`}>
                    <MoreHorizontal className="w-6 h-6 mb-0.5" />
                    <span className="text-[10px] font-bold leading-none">{t.menu_more}</span>
                  </button>
                </div>
            </div>
        </>

        <WalletManagerModal isOpen={isWalletModalOpen} onClose={() => setIsWalletModalOpen(false)} onSuccess={fetchData} currentDate={currentDate} />
        <ConfirmModal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={confirmDelete} title={t.history} message={customDeleteMessage} />
        <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
}

function AppRoutes() {
  const { token, setToken } = useAuth();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');
    if (tokenFromUrl) {
      localStorage.setItem('token', tokenFromUrl);
      setToken(tokenFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [setToken]);
  const params = new URLSearchParams(window.location.search);
  const isAuthenticated = token || params.get('token');
  return (
    <>
       <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/" element={isAuthenticated ? <DashboardContent /> : <Navigate to="/login" replace />} />
          <Route path="/manage-users" element={isAuthenticated ? <ManageUsersPage /> : <Navigate to="/login" replace />} />
          <Route path="/add-transaction" element={isAuthenticated ? <AddTransaction /> : <Navigate to="/login" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
       </Routes>
       {isAuthenticated && <AIFloatingButton />}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <LanguageProvider>
            <PrivacyProvider>
              <AppRoutes /> 
              <GlobalLoader />
              <Toaster 
                position="top-center" 
                toastOptions={{
                  duration: 3000, 
                  style: { background: 'rgba(31, 41, 55, 0.95)', color: '#fff', borderRadius: '50px', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '13px', fontWeight: '600', padding: '10px 20px', boxShadow: '0px 10px 30px rgba(0,0,0,0.2)' },
                  success: { iconTheme: { primary: '#4ade80', secondary: '#1f2937' } },
                  error: { iconTheme: { primary: '#ef4444', secondary: '#1f2937' } },
              }}
              containerStyle={{ top: 40, zIndex: 99999 }} 
              />
            </PrivacyProvider>
        </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;