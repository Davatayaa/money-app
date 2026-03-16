import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, ArrowUpRight, ArrowDownLeft, Tag, ArrowRightLeft, Camera } from 'lucide-react';
import SwipeableItem from './SwipeableItem';
import { useLanguage } from '../contexts/LanguageContext'; 

export default function TransactionGroup({ date, transactions = [], wallets, onSwipe, onClickItem }) {
    const { t, language, translateCategory, translateDescription } = useLanguage();
    
    const [isOpen, setIsOpen] = useState(true);
    
    const safeTransactions = transactions || [];

    const isExcludedFromSummary = (trx) => {
        const desc = (trx.description || '').toLowerCase();
        const cat = (trx.category_name || '').toLowerCase();
        
        return desc.includes('transfer') || 
               desc.includes('terima dari') || 
               desc.includes('balance adjustment') || 
               desc.includes('pindah dana') ||
               cat.includes('transfer') ||
               cat.includes('balance adjustment');   
    };

    const getTransactionLabel = (trx) => {
        const desc = (trx.description || '').toLowerCase();
        const cat = (trx.category_name || '').toLowerCase();

        if (desc.includes('balance adjustment') || cat.includes('balance adjustment') || cat.includes('koreksi')) {
            return translateCategory(trx.category_name || 'Adjustment');
        }

        if (desc.includes('transfer') || desc.includes('terima dari') || desc.includes('pindah dana') || cat.includes('transfer')) {
            return "Transfer";
        }

        return translateCategory(trx.category_name || 'Umum');
    };

    const { dailyIncome, dailyExpense } = useMemo(() => {
        return safeTransactions.reduce((acc, curr) => {
            if (isExcludedFromSummary(curr)) return acc;

            if (curr.type === 'INCOME') {
                acc.dailyIncome += curr.amount;
            } else {
                acc.dailyExpense += curr.amount;
            }
            return acc;
        }, { dailyIncome: 0, dailyExpense: 0 });
    }, [safeTransactions]);

    const dateObj = new Date(date);
    const locale = language === 'id' ? 'id-ID' : 'en-US';
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    let headerLabel = "";
    if (dateObj.toDateString() === today.toDateString()) {
        headerLabel = t.today || "TODAY";
    } else if (dateObj.toDateString() === yesterday.toDateString()) {
        headerLabel = t.yesterday || "YESTERDAY";
    } else {
        headerLabel = dateObj.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
    }

    const getWalletName = (walletId) => {
        const found = wallets.find(w => w.id === walletId);
        return found ? found.name : 'Unknown';
    };

    if (safeTransactions.length === 0) return null;

    return (
        <div className="mb-2">
            <div onClick={() => setIsOpen(!isOpen)} className="flex justify-between items-center py-3 px-1 cursor-pointer sticky top-0 z-20 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm transition-all border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <span className={`text-xs font-bold uppercase tracking-wider ${headerLabel === (t.today || "TODAY") ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'}`}>
                        {headerLabel}
                    </span>
                </div>
                
                <div className="flex items-center gap-3">
                    {dailyIncome > 0 && <span className="text-xs font-bold text-green-600 dark:text-green-400">+ {dailyIncome.toLocaleString('id-ID')}</span>}
                    {dailyExpense > 0 && <span className="text-xs font-bold text-red-500 dark:text-red-400">- {dailyExpense.toLocaleString('id-ID')}</span>}
                </div>
            </div>

            {isOpen && (
                <div className="space-y-2 mt-2">
                    {safeTransactions.map((trx) => {
                        const isSpecial = isExcludedFromSummary(trx);
                        
                        const isPureTransfer = (trx.description || '').toLowerCase().includes('transfer') || (trx.category_name || '').toLowerCase().includes('transfer');
                        
                        let iconBgClass = "";
                        let iconColorClass = "";
                        let amountColorClass = "";
                        let IconComponent = null;

                        if (isSpecial) {
                            iconBgClass = "bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/30";
                            iconColorClass = "text-blue-500 dark:text-blue-400";
                            amountColorClass = "text-blue-600 dark:text-blue-400"; 
                            IconComponent = ArrowRightLeft;
                        } else if (trx.type === 'EXPENSE') {
                            iconBgClass = "bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-900/30";
                            iconColorClass = "text-red-500";
                            amountColorClass = "text-red-500 dark:text-red-400";
                            IconComponent = ArrowUpRight;
                        } else {
                            iconBgClass = "bg-green-50 border-green-100 dark:bg-green-900/20 dark:border-green-900/30";
                            iconColorClass = "text-green-500";
                            amountColorClass = "text-green-500 dark:text-green-400";
                            IconComponent = ArrowDownLeft;
                        }

                        return (
                            <SwipeableItem key={trx.id} type={trx.type} onTriggerDelete={() => onSwipe(trx.id)} onClick={() => onClickItem(trx)}>
                               <div className="flex items-center justify-between pointer-events-none">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${iconBgClass} ${iconColorClass}`}>
                                            <IconComponent className="w-5 h-5" />
                                        </div>
                                        
                                        <div className="flex-1 overflow-hidden">
                                            <div className="flex items-center gap-1.5">
                                                <p className="font-bold text-gray-800 dark:text-white text-sm truncate">
                                                    {translateDescription(trx.description) || t.noDescription || 'Tanpa Keterangan'}
                                                </p>

                                                {trx.photo_url && (
                                                    <Camera className="w-3 h-3 text-blue-500 flex-shrink-0" />
                                                )}
                                            </div>
                                            
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5 truncate">
                                                <span className="flex items-center gap-1">{getWalletName(trx.wallet_id)}</span>
                                                <span className="text-gray-300">•</span>
                                                <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400 font-medium">
                                                    <Tag className="w-3 h-3" />
                                                    {getTransactionLabel(trx)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <p className={`font-bold text-sm whitespace-nowrap pl-2 ${amountColorClass}`}>
                                        {trx.type === 'EXPENSE' ? '- ' : '+ '} Rp {trx.amount.toLocaleString('id-ID')}
                                    </p>
                                </div>
                            </SwipeableItem>
                        );
                    })}
                </div>
            )}
        </div>
    );
}