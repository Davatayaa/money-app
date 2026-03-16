import { useState, useEffect } from 'react';
import api from '@/services/api';
import { X, Trash2, Pencil, Plus, ArrowRightLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import ConfirmModal from './ConfirmModal';
import TransferModal from './TransferModal';

export default function WalletManagerModal({ isOpen, onClose, onSuccess, currentDate }) {
  const { t, language } = useLanguage();

  const [wallets, setWallets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [isEditing, setIsEditing] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  
  const [isTransferOpen, setIsTransferOpen] = useState(false); 

  const [name, setName] = useState('');
  const [type, setType] = useState('Bank');
  const [balance, setBalance] = useState(''); 

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [walletToDelete, setWalletToDelete] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchWallets();
      fetchCategories();
      resetForm();
    }
  }, [isOpen]);

  const fetchWallets = async () => {
    try {
      const res = await api.get('/wallets');
      setWallets(res.data.data || []);
    } catch (error) { console.error("Error fetching wallets", error); }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data.data || []);
    } catch (error) { console.error("Error fetching categories", error); }
  };

  const resetForm = () => {
    setName(''); setType('Bank'); setBalance(''); 
    setIsEditing(null); setIsAdding(false);
  };

  const handleEditClick = (wallet) => {
    setIsEditing(wallet.id); setIsAdding(false);
    setName(wallet.name); setType(wallet.type);
    setBalance(wallet.balance.toString()); 
  };

  const requestDelete = (id) => {
    setWalletToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!walletToDelete) return;
    try {
      await api.delete(`/wallets/${walletToDelete}`);
      toast.success(t.walletDeleted || "Success", { duration: 3000 });
      fetchWallets(); 
      if (onSuccess) onSuccess();
      setIsDeleteConfirmOpen(false);
    } catch (error) { 
        if (error.response && error.response.status === 409) {
            const rawMsg = error.response.data.message; 
            if (language === 'en') {
                const match = rawMsg.match(/(\d+)/); 
                const count = match ? match[0] : ''; 
                const msg = t.error_wallet_has_trx_dynamic 
                    ? t.error_wallet_has_trx_dynamic(count)
                    : `Failed! This wallet has ${count} transactions.`;
                toast.error(msg, { duration: 5000 }); 
            } else {
                toast.error(rawMsg, { duration: 5000 });
            }
        } else {
            toast.error(error.response?.data?.message || t.error_generic, { duration: 3000 });
        }
    }
  };

  const executeSubmit = async (payload) => {
    setLoading(true);
    try {
      if (isEditing) await api.put(`/wallets/${isEditing}`, payload);
      else await api.post('/wallets', payload);
      
      toast.success(isEditing ? (t.walletUpdated || "Success") : (t.walletAdded || "Success"), { duration: 3000 });
      fetchWallets(); onSuccess(); resetForm();
    } catch (error) { 
        toast.error(error.response?.data?.message || "Error: " + error.message, { duration: 3000 }); 
    } 
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = { 
        name, 
        type, 
        balance: 0
    };

    executeSubmit(payload);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
      
      <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700 relative">
        
        <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">{t.manageWallet || "Kelola Dompet"}</h2>
          <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 transition pointer-events-auto"><X className="w-4 h-4 text-gray-500 dark:text-gray-300" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
            {!isAdding && !isEditing && (
                <>
                    {wallets.length > 0 ? (
                        wallets.map(w => (
                            <div key={w.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                <div>
                                    <h4 className="font-bold text-gray-800 dark:text-white">{w.name}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{w.type} • Rp {w.balance.toLocaleString('id-ID')}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEditClick(w)} className="p-2 text-blue-500 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 transition"><Pencil className="w-4 h-4" /></button>
                                    <button onClick={() => requestDelete(w.id)} className="p-2 text-red-500 bg-red-50 dark:bg-red-900/30 rounded-lg hover:bg-red-100 transition"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-gray-400 text-xs">
                            {t.no_wallet_yet || "Belum ada dompet."}
                        </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <button 
                            onClick={() => setIsTransferOpen(true)}
                            className="w-full py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-600 dark:text-blue-400 font-bold text-xs hover:bg-blue-100 transition flex items-center justify-center gap-2"
                        >
                            <ArrowRightLeft className="w-4 h-4" /> Transfer
                        </button>

                        <button 
                            onClick={() => setIsAdding(true)} 
                            className="w-full py-3 border-2 border-dashed border-blue-200 dark:border-blue-900/50 rounded-xl text-blue-500 font-bold text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20 transition flex items-center justify-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> {t.addWallet || "Tambah"}
                        </button>
                    </div>
                </>
            )}

            {(isAdding || isEditing) && (
                <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl animate-in slide-in-from-bottom-2">
                    <h3 className="font-bold text-sm text-gray-700 dark:text-gray-200">{isEditing ? (t.edit_wallet || "Edit Dompet") : (t.add_new_wallet || "Tambah Dompet")}</h3>
                    
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase">{t.label_wallet_name || "NAMA DOMPET"}</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={t.ph_wallet_name || "Contoh: BCA"} className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white" required />
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase">{t.label_wallet_type || "TIPE DOMPET"}</label>
                        <select value={type} onChange={e => setType(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white">
                            <option value="Bank">Bank</option>
                            <option value="E-Wallet">E-Wallet</option>
                            <option value="Cash">Cash</option>
                        </select>
                    </div>


                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={resetForm} className="flex-1 py-2.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-200 rounded-lg text-sm font-bold hover:bg-gray-300 transition">{t.btn_cancel}</button>
                        <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-lg hover:bg-blue-700 transition active:scale-95">{loading ? '...' : (isEditing ? t.btn_update : t.btn_save)}</button>
                    </div>
                </form>
            )}
        </div>
      </div>

      {isDeleteConfirmOpen && (
        <ConfirmModal 
            isOpen={isDeleteConfirmOpen}
            onClose={() => setIsDeleteConfirmOpen(false)}
            onConfirm={confirmDelete}
            title={t.deleteWalletTitle || "Hapus Dompet?"}
            message={t.deleteWalletMsg || "Saldo dan semua riwayat transaksi di dompet ini akan hilang permanen."}
        />
      )}

      {isTransferOpen && (
        <TransferModal 
            isOpen={isTransferOpen}
            onClose={() => setIsTransferOpen(false)}
            wallets={wallets}
            onSuccess={() => {
                fetchWallets(); 
                if (onSuccess) onSuccess(); 
            }}
        />
      )}

    </div>
  );
}