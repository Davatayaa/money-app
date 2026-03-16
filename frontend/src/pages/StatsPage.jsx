import { useState, useMemo, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, 
  AreaChart, Area 
} from 'recharts';
import { 
  Wallet, PieChart as PieIcon, BarChart as BarIcon, 
  ArrowUpCircle, ArrowDownCircle, Pencil, ChevronRight, 
  ArrowLeft, Clock, Eye, EyeOff 
} from 'lucide-react'; 
import { useLanguage } from '../contexts/LanguageContext'; 
import { usePrivacy } from '../contexts/PrivacyContext';
import api from '@/services/api';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];

export default function StatsPage({ allTransactions, wallets, currentDate, onOpenWalletModal }) {
  const { t, language } = useLanguage();
  const { privacyMode, togglePrivacy } = usePrivacy();
  
  const [viewMode, setViewMode] = useState('category'); 
  const [pieType, setPieType] = useState('EXPENSE');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [yearlyTrend, setYearlyTrend] = useState([]);

  const fetchTrendData = async () => {
    try {
      const year = currentDate.getFullYear();
      const res = await api.get(`/transactions/trend?year=${year}`);
      setYearlyTrend(res.data.data || []);
    } catch (error) {
      console.error("Gagal mengambil data tren:", error);
    }
  };

  useEffect(() => {
    fetchTrendData();
  }, [currentDate.getFullYear()]);

  const totalNetWorth = useMemo(() => {
    return (wallets || []).reduce((acc, curr) => acc + (curr.balance || 0), 0);
  }, [wallets]);

  const validTransactions = useMemo(() => {
    return (allTransactions || []).filter(trx => {
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
  }, [allTransactions]);

  const monthlyTransactions = useMemo(() => {
      return validTransactions; 
  }, [validTransactions]);

  const categoryDetailTransactions = useMemo(() => {
    if (!selectedCategory) return [];
    return monthlyTransactions.filter(trx => {
        const catName = trx.category_name || (wallets.find(w => w.id === trx.wallet_id)?.name) || 'Lainnya';
        return catName === selectedCategory && trx.type === pieType;
    }).sort((a, b) => new Date(b.date) - new Date(a.date)); 
  }, [monthlyTransactions, selectedCategory, pieType, wallets]);

  const pieChartData = useMemo(() => {
    const grouped = {};
    let total = 0;
    
    monthlyTransactions.forEach(trx => {
      if (trx.type === pieType) {
        const catName = trx.category_name || (wallets.find(w => w.id === trx.wallet_id)?.name) || 'Lainnya';
        if (!grouped[catName]) grouped[catName] = 0;
        grouped[catName] += trx.amount;
        total += trx.amount;
      }
    });

    return Object.keys(grouped).map(name => ({
      name, 
      value: grouped[name], 
      percentage: total === 0 ? 0 : ((grouped[name] / total) * 100).toFixed(1)
    })).sort((a, b) => b.value - a.value);
  }, [monthlyTransactions, pieType, wallets]);

  const totalPieAmount = pieChartData.reduce((sum, item) => sum + item.value, 0);

  const trendData = useMemo(() => {
    const locale = language === 'id' ? 'id-ID' : 'en-US';
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setMonth(i);
      return {
        name: d.toLocaleDateString(locale, { month: 'short' }),
        income: 0,
        expense: 0,
        net: 0,
        mIdx: i + 1
      };
    });

    yearlyTrend.forEach(item => {
      const m = months.find(mo => mo.mIdx === item.month);
      if (m) {
        m.income = item.income;
        m.expense = item.expense;
        m.net = item.income - item.expense;
      }
    });

    return months;
  }, [yearlyTrend, language]);

  const formatCompactNumber = (number) => {
    return new Intl.NumberFormat(language === 'id' ? 'id-ID' : 'en-US', {
      notation: "compact",
      compactDisplay: "short"
    }).format(number);
  };

  const monthName = currentDate.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { month: 'long', year: 'numeric' });

  const formatDetailDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  };

  if (selectedCategory) {
    return (
      <div className="fixed inset-0 z-[60] bg-gray-50 dark:bg-gray-900 overflow-y-auto animate-in slide-in-from-right duration-300">
         <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 pt-14 pb-4 px-4 flex items-center gap-4 z-10 shadow-sm">
            <button onClick={() => setSelectedCategory(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition">
                <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-white" />
            </button>
            <div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">{selectedCategory}</h2>
                <p className="text-xs text-gray-500">{monthName} • {categoryDetailTransactions.length} Transaksi</p>
            </div>
         </div>
         <div className="p-4 pb-20">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 text-center">
                <p className="text-sm text-gray-500 mb-1">Total {pieType === 'EXPENSE' ? t.expense : t.income}</p>
                <h1 className={`text-3xl font-bold ${pieType === 'EXPENSE' ? 'text-red-500' : 'text-green-500'}`}>
                    Rp {categoryDetailTransactions.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('id-ID')}
                </h1>
            </div>
            <div className="space-y-3">
                {categoryDetailTransactions.map((trx) => (
                    <div key={trx.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex justify-between items-center">
                        <div className="flex flex-col gap-1">
                            <h4 className="font-bold text-gray-800 dark:text-white text-sm line-clamp-1">{trx.description || selectedCategory}</h4>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <Clock className="w-3 h-3" />
                                <span>{formatDetailDate(trx.date)}</span>
                            </div>
                        </div>
                        <div className={`font-bold text-sm ${trx.type === 'EXPENSE' ? 'text-red-500' : 'text-green-500'}`}>
                            {trx.type === 'EXPENSE' ? '-' : '+'} Rp {trx.amount.toLocaleString('id-ID')}
                        </div>
                    </div>
                ))}
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="pb-32 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4 shadow-sm">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">{t.analysisTitle}</h2>
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          <button onClick={() => setViewMode('category')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'category' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}><PieIcon className="w-4 h-4" /> {t.view_category}</button>
          <button onClick={() => setViewMode('trend')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'trend' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}><BarIcon className="w-4 h-4" /> {t.view_trend}</button>
        </div>
      </div>

      <div className="px-6 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div onClick={onOpenWalletModal} className="group cursor-pointer bg-gradient-to-r from-blue-600 to-blue-500 p-5 rounded-2xl shadow-lg shadow-blue-500/20 mb-6 text-white relative overflow-hidden active:scale-95 transition-transform">
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-1 opacity-90">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4" />
                      <p className="text-xs uppercase tracking-wider font-medium">{t.totalAssets}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); togglePrivacy(); }} className="p-1.5 rounded-full hover:bg-white/20 transition z-50 relative">
                        {privacyMode ? <EyeOff className="w-4 h-4 text-white" /> : <Eye className="w-4 h-4 text-white" />}
                    </button>
                </div>
                <div className="flex items-center gap-2">
                   <h2 className="text-3xl font-bold">{privacyMode ? "Rp ••••••••" : `Rp ${totalNetWorth.toLocaleString('id-ID')}`}</h2>
                   <ChevronRight className="w-5 h-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                </div>
                <p className="text-[10px] opacity-70 mt-1">{t.btn_total_balance}</p>
            </div>
            <div className="absolute -right-4 -bottom-8 opacity-20 text-white"><Wallet className="w-32 h-32 rotate-12" /></div>
        </div>

        {viewMode === 'category' && (
          <div className="animate-in fade-in duration-300">
              <div className="mb-4 text-center"><span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">{t.dataMonth}: {monthName}</span></div>
              <div className="flex bg-white dark:bg-gray-800 p-1 rounded-xl mb-6 border border-gray-200 dark:border-gray-700">
                <button onClick={() => setPieType('EXPENSE')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${pieType === 'EXPENSE' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800' : 'text-gray-500 dark:text-gray-400'}`}>{t.expense}</button>
                <button onClick={() => setPieType('INCOME')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${pieType === 'INCOME' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 ring-1 ring-green-200 dark:ring-green-800' : 'text-gray-500 dark:text-gray-400'}`}>{t.income}</button>
              </div>

              {pieChartData.length > 0 ? (
                <>
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-4">
                      <div className="h-64 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                              {pieChartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                            </Pie>
                            <Tooltip formatter={(value) => `Rp ${value.toLocaleString('id-ID')}`} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <p className="text-xs text-gray-400 uppercase">{t.stats_total}</p>
                            <p className="text-sm font-bold text-gray-800 dark:text-white">Rp {formatCompactNumber(totalPieAmount)}</p>
                        </div>
                      </div>
                  </div>
                  <div className="space-y-3">
                    {pieChartData.map((item, index) => (
                      <div key={item.name} onClick={() => setSelectedCategory(item.name)} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition active:scale-[0.98]">
                          <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                              <span className="text-sm font-bold text-gray-700 dark:text-white">{item.name}</span>
                          </div>
                          <div className="text-right flex items-center gap-3">
                              <div><p className="text-sm font-bold text-gray-800 dark:text-white">Rp {item.value.toLocaleString('id-ID')}</p><p className="text-[10px] text-gray-400">{item.percentage}%</p></div>
                              <ChevronRight className="w-4 h-4 text-gray-300" />
                          </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-20 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl"><p>{t.noData} ({pieType === 'EXPENSE' ? t.expense : t.income})</p></div>
              )}
          </div>
        )}

        {viewMode === 'trend' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="mb-0 text-center"><span className="bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">{t.dataYear}: {currentDate.getFullYear()}</span></div>
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2"><BarIcon className="w-4 h-4 text-blue-500" /> {t.cashflowYear}</h3>
              <div className="h-64 w-full -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9CA3AF'}} interval={0} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9CA3AF'}} tickFormatter={formatCompactNumber} />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '12px'}} formatter={(value) => `Rp ${formatCompactNumber(value)}`} />
                    <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                    <Bar dataKey="income" name={t.income} fill="#10B981" radius={[4, 4, 0, 0]} barSize={8} />
                    <Bar dataKey="expense" name={t.expense} fill="#EF4444" radius={[4, 4, 0, 0]} barSize={8} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
               <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2"><ArrowUpCircle className="w-4 h-4 text-green-500" /> {t.netIncomeTrend}</h3>
              <div className="h-48 w-full -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs><linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10B981" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9CA3AF'}} />
                    <YAxis hide />
                    <Tooltip contentStyle={{borderRadius: '12px'}} formatter={(value) => [`Rp ${formatCompactNumber(value)}`, t.remaining]} />
                    <Area type="monotone" dataKey="net" stroke="#10B981" fillOpacity={1} fill="url(#colorNet)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}