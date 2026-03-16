import { useState, useEffect } from 'react';
import api from '@/services/api';
import { X, ArrowRightLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

export default function TransferModal({ isOpen, onClose, wallets, onSuccess }) {
  const { t, language } = useLanguage(); 
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    from_wallet_id: '',
    to_wallet_id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        from_wallet_id: '',
        to_wallet_id: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
      });
    }
  }, [isOpen]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAmountChange = (e) => {
    const val = e.target.value.replace(/\D/g, ''); 
    setFormData({ ...formData, amount: val });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.from_wallet_id || !formData.to_wallet_id || !formData.amount) {
      toast.error(t.fillAllFields || "Mohon lengkapi semua data");
      return;
    }
    if (Number(formData.from_wallet_id) === Number(formData.to_wallet_id)) {
      toast.error(t.sameWalletError || "Dompet asal dan tujuan tidak boleh sama");
      return;
    }

    setLoading(true);
    try {
      await api.post(`/transactions/transfer?lang=${language}`, {
        from_wallet_id: parseInt(formData.from_wallet_id),
        to_wallet_id: parseInt(formData.to_wallet_id),
        amount: parseFloat(formData.amount),
        date: formData.date, 
        description: formData.description,
      });

      toast.success(t.transferSuccess || "Transfer Berhasil!");
      if (onSuccess) onSuccess(); 
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Transfer Gagal");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700">
        
        <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
          <h2 className="text-lg font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" /> {t.transferTitle || "Transfer Dana"}
          </h2>
          <button onClick={onClose} className="p-2 bg-white/50 dark:bg-black/20 rounded-full hover:bg-white dark:hover:bg-black/40 transition"><X className="w-4 h-4 text-gray-600 dark:text-gray-300" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
            
            <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">{t.fromWallet || "DARI DOMPET"}</label>
                <select 
                    name="from_wallet_id" 
                    value={formData.from_wallet_id} 
                    onChange={handleChange}
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                >
                    <option value="">-- {t.select || "Pilih"} --</option>
                    {wallets.map(w => (
                        <option key={w.id} value={w.id}>{w.name} (Rp {w.balance.toLocaleString('id-ID')})</option>
                    ))}
                </select>
            </div>

            <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">{t.toWallet || "KE DOMPET"}</label>
                <select 
                    name="to_wallet_id" 
                    value={formData.to_wallet_id} 
                    onChange={handleChange}
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                >
                    <option value="">-- {t.select || "Pilih"} --</option>
                    {wallets.map(w => (
                        <option key={w.id} value={w.id}>{w.name} (Rp {w.balance.toLocaleString('id-ID')})</option>
                    ))}
                </select>
            </div>

            <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">{t.amount || "NOMINAL"}</label>
                <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-400 font-bold">Rp</span>
                    <input 
                        type="text" 
                        name="amount" 
                        value={formData.amount ? Number(formData.amount).toLocaleString('id-ID') : ''} 
                        onChange={handleAmountChange}
                        className="w-full pl-10 p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                        placeholder="0"
                    />
                </div>
            </div>

            <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">{t.date || "TANGGAL"}</label>
                <input 
                    type="date" 
                    name="date" 
                    value={formData.date} 
                    onChange={handleChange}
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                />
            </div>

            <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">{t.description || "CATATAN (OPSIONAL)"}</label>
                <input 
                    type="text" 
                    name="description" 
                    value={formData.description} 
                    onChange={handleChange}
                    placeholder={t.ph_desc_transfer || "Contoh: Bayar hutang"}
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                />
            </div>

            <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 active:scale-95 transition mt-2"
            >
                {loading ? (t.processing || "Memproses...") : (t.transferNow || "Transfer Sekarang")}
            </button>

        </form>
      </div>
    </div>
  );
}