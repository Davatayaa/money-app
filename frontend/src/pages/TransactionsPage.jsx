import { useState, useRef } from 'react';
import { Wallet, Pencil, Receipt, ChevronUp, ChevronDown, Plus, ChevronRight } from 'lucide-react';
import TransactionGroup from '../components/TransactionGroup';
import { useLanguage } from '../contexts/LanguageContext';

export default function TransactionsPage({ 
  walletsWithMonthlyStats, 
  shortMonth, 
  monthLabel, 
  groupedTransactions, 
  wallets, 
  onSwipe, 
  onClickItem, 
  onOpenWalletModal 
}) {
  const { t } = useLanguage();
  const [isWalletExpanded, setIsWalletExpanded] = useState(false);
  const walletScrollRef = useRef(null);

  return (
    <>
      <div className="px-6 mt-4 pb-2">
        <div onClick={() => setIsWalletExpanded(!isWalletExpanded)} className="flex justify-between items-center cursor-pointer py-2 group select-none">
            <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 text-xs uppercase tracking-wider group-hover:text-blue-600 transition">
                <Wallet className="w-4 h-4 text-blue-600 dark:text-blue-400" /> {t.myWallet} {isWalletExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </h3>
            {isWalletExpanded && <button onClick={(e) => { e.stopPropagation(); onOpenWalletModal(); }} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-2 py-1 rounded-full transition flex items-center gap-1"><Pencil className="w-3 h-3" /> Edit</button>}
        </div>
        
        {isWalletExpanded && (
            <div className="mt-2 w-full animate-in slide-in-from-top-2 duration-200">
            {Array.isArray(walletsWithMonthlyStats) && walletsWithMonthlyStats.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide min-h-[120px]">
                {walletsWithMonthlyStats.map((wallet) => (
                    <div key={wallet.id} className="min-w-[200px] bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between h-28 relative overflow-hidden">
                      
                      <div className="z-10">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-gray-500 dark:text-gray-400 text-[10px] uppercase font-bold tracking-wider truncate pr-2 max-w-[80px]">
                            {wallet.type || 'Umum'}
                          </p>
                          <div className="flex flex-col items-end">
                             <span className="text-[8px] text-gray-400 leading-none mb-0.5">{t.currentBalance}</span>
                             <span className="text-[9px] font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                               Rp {wallet.balance.toLocaleString('id-ID')}
                             </span>
                          </div>
                        </div>
                        <p className="font-bold text-gray-800 dark:text-white truncate text-sm mt-0.5 w-full pr-1">
                          {wallet.name || 'Tanpa Nama'}
                        </p>
                      </div>

                      <div className="z-10">
                          <p className={`font-bold text-lg ${wallet.monthly_flow === 0 ? 'text-gray-400' : wallet.monthly_flow > 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {wallet.monthly_flow === 0 
                                  ? 'Rp 0' 
                                  : (wallet.monthly_flow > 0 ? '+ ' : '- ') + `Rp ${Math.abs(wallet.monthly_flow).toLocaleString('id-ID')}`
                              }
                          </p>
                          <p className="text-[9px] text-gray-400 mt-0.5 font-medium flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${wallet.monthly_flow > 0 ? 'bg-green-500' : wallet.monthly_flow < 0 ? 'bg-red-500' : 'bg-gray-300'}`}></span>
                            {t.mutation} {shortMonth}
                          </p>
                      </div>
                      
                      <div className="absolute -right-4 -bottom-4 opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
                         <Wallet className="w-20 h-20 text-gray-900 dark:text-white rotate-12" />
                      </div>
                    </div>
                ))}
                </div>
            ) : (
                <div className="w-full text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50"><p className="text-xs text-gray-400 mb-2">{t.no_wallet_yet}</p><button onClick={onOpenWalletModal} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold shadow-sm">+ {t.btn_add_wallet}</button></div>
            )}
            </div>
        )}
      </div>

        
      <div className="px-6 pb-32">
        <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2 text-xs uppercase tracking-wider sticky top-0 bg-gray-50 dark:bg-gray-900 py-3 z-30 border-b border-transparent">
            <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" /> {t.history}
        </h3>
        <div className="space-y-2">
            {groupedTransactions.length > 0 ? (
                groupedTransactions.map((group, index) => (
                    <TransactionGroup key={index} date={group.date} transactions={group.items} wallets={wallets} onSwipe={onSwipe} onClickItem={onClickItem} />
                ))
            ) : (
                <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700"><p className="text-gray-400">{t.noTransaction} {monthLabel}.</p></div>
            )}
        </div>
      </div>
    </>
  );
}