import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, ArrowDownLeft, CheckCircle, Trash2, Calendar, Clock, Pencil, Bell, FileText } from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import ConfirmModal from '@/components/ConfirmModal';

export default function DebtModal({ isOpen, onClose }) {
  const { t } = useLanguage(); 

  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({ hutang: 0, piutang: 0 });

  const [isAdding, setIsAdding] = useState(false);
  const [editId, setEditId] = useState(null); 
  
  const [formData, setFormData] = useState({
    person_name: '',
    amount: '',
    type: 'HUTANG',
    due_date: '',
    reminder_time: '09:00',
    description: '',
    reminder_days_before: 0
  });

  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, type: null, id: null });

  useEffect(() => {
    if (isOpen) {
        fetchDebts();
        resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
      setIsAdding(false);
      setEditId(null);
      setFormData({ 
          person_name: '', amount: '', type: 'HUTANG', 
          due_date: '', reminder_time: '09:00', description: '', reminder_days_before: 0 
      });
  };

  const fetchDebts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/debts');
      const data = res.data.data || [];
      setDebts(data);
      
      let h = 0, p = 0;
      data.forEach(d => {
        if(d.status === 'BELUM_LUNAS') {
            if (d.type === 'HUTANG') h += d.amount;
            else p += d.amount;
        }
      });
      setSummary({ hutang: h, piutang: p });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => num ? num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : '';
  const parseNumber = (str) => str ? str.replace(/\./g, '') : '';
  const formatRp = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

  const handleEdit = (item) => {
      setEditId(item.id);
      const safeDate = item.due_date ? item.due_date.substring(0, 10) : '';

      setFormData({
          person_name: item.person_name,
          amount: formatNumber(item.amount),
          type: item.type,
          due_date: safeDate,
          reminder_time: item.reminder_time || '09:00',
          description: item.description || '',
          reminder_days_before: item.reminder_days_before || 0
      });
      setIsAdding(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const rawAmount = parseNumber(formData.amount);

    if(!formData.person_name || !rawAmount || !formData.due_date) {
        return toast.error(t.err_req || "Data wajib diisi!");
    }

    const payload = {
        ...formData,
        amount: parseFloat(rawAmount),
        reminder_days_before: parseInt(formData.reminder_days_before),
        reminder_time: formData.reminder_time || '09:00'
    };

    try {
      if (editId) {
          await api.put(`/debts/${editId}`, payload);
          toast.success(t.debt_updated || "Updated");
      } else {
          await api.post('/debts', payload);
          toast.success(t.debt_saved || "Saved");
      }
      
      resetForm();
      fetchDebts();
    } catch (error) {
      console.error(error);
      toast.error("Error saving data");
    }
  };

  const triggerAction = (type, id) => {
      setConfirmConfig({ isOpen: true, type, id });
  };

  const handleConfirmAction = async () => {
    const { type, id } = confirmConfig;
    try {
        if (type === 'DELETE') {
            await api.delete(`/debts/${id}`);
            toast.success(t.debt_deleted || "Deleted");
        } else if (type === 'PAY') {
            await api.put(`/debts/${id}/pay`);
            toast.success(t.debt_settled || "Lunas");
        }
        fetchDebts();
    } catch (error) {
        toast.error("Error");
    } finally {
        setConfirmConfig({ ...confirmConfig, isOpen: false });
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4 animate-in fade-in duration-200">
        
        <div className="bg-gray-50 dark:bg-gray-900 w-full max-w-md h-[100dvh] sm:h-auto sm:max-h-[85vh] sm:rounded-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 duration-200 relative pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            
            <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center sm:rounded-t-2xl">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">{t.debt_title || "Buku Hutang"}</h2>
                <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 transition">
                    <X className="w-5 h-5 text-gray-500 dark:text-gray-300" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 scrollbar-hide">
            
            {!isAdding && (
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-800/30">
                        <p className="text-xs text-red-500 font-bold uppercase mb-1">{t.my_debt}</p>
                        <p className="text-lg font-bold text-red-700 dark:text-red-400">{formatRp(summary.hutang)}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-100 dark:border-green-800/30">
                        <p className="text-xs text-green-500 font-bold uppercase mb-1">{t.their_debt}</p>
                        <p className="text-lg font-bold text-green-700 dark:text-green-400">{formatRp(summary.piutang)}</p>
                    </div>
                </div>
            )}

            {isAdding ? (
                <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm space-y-4 animate-in zoom-in-95">
                <h3 className="font-bold text-gray-800 dark:text-white mb-4">{editId ? t.edit_debt : t.add_debt}</h3>
                
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                    <button type="button" onClick={() => setFormData({...formData, type: 'HUTANG'})}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${formData.type === 'HUTANG' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}>
                        {t.my_debt}
                    </button>
                    <button type="button" onClick={() => setFormData({...formData, type: 'PIUTANG'})}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${formData.type === 'PIUTANG' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}>
                        {t.their_debt}
                    </button>
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">{t.debt_person}</label>
                    <input type="text" placeholder={t.ph_person_name || "Contoh: Budi"} value={formData.person_name}
                        onChange={e => setFormData({...formData, person_name: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl outline-none focus:ring-2 ring-indigo-500 dark:text-white text-sm" />
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">{t.debt_amount}</label>
                    <div className="relative">
                        <span className="absolute left-4 top-3.5 font-bold text-gray-400">Rp</span>
                        <input type="text" placeholder="0" value={formData.amount} onChange={e => {
                             const raw = parseNumber(e.target.value);
                             if (!isNaN(raw)) setFormData({ ...formData, amount: formatNumber(raw) });
                        }}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl outline-none focus:ring-2 ring-indigo-500 dark:text-white font-bold text-lg" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">{t.debt_date}</label>
                        <input type="date" value={formData.due_date} 
                            onChange={e => setFormData({...formData, due_date: e.target.value})}
                            className="w-full px-3 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl outline-none focus:ring-2 ring-indigo-500 dark:text-white text-sm" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">
                            {t.time_label || "Waktu"} <span className="font-normal text-[10px] opacity-70">({t.optional || "Opsional"})</span>
                        </label>
                        <input 
                            type="time" 
                            value={formData.reminder_time} 
                            onChange={e => setFormData({...formData, reminder_time: e.target.value})}
                            className="w-full px-3 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl outline-none focus:ring-2 ring-indigo-500 dark:text-white text-sm cursor-pointer" 
                        />
                    </div>
                </div>

                <div>
                      <label className="text-xs font-bold text-gray-500 mb-1 block">
                          {t.reminder_label || "Pengingat"}
                      </label>
                      <div className="relative">
                        <Bell className="w-3.5 h-3.5 absolute left-3 top-3.5 text-gray-400" />
                        <select 
                            value={formData.reminder_days_before} 
                            onChange={e => setFormData({...formData, reminder_days_before: e.target.value})}
                            className="w-full pl-9 pr-2 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl outline-none focus:ring-2 ring-indigo-500 dark:text-white text-sm appearance-none cursor-pointer"
                        >
                            <option value="0">{t.remind_0_days || "Hari H (Pas Jatuh Tempo)"}</option>
                            <option value="1">{t.remind_1_day || "H-1 (Sehari Sebelumnya)"}</option>
                            <option value="3">{t.remind_3_days || "H-3 (3 Hari Sebelumnya)"}</option>
                            <option value="7">{t.remind_7_days || "H-7 (Seminggu Sebelumnya)"}</option>
                        </select>
                      </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">{t.debt_note} <span className="font-normal text-[10px] opacity-70">(Opsional)</span></label>
                    <textarea 
                        rows="2"
                        placeholder={t.ph_debt_note || "Keterangan..."} 
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl outline-none focus:ring-2 ring-indigo-500 dark:text-white text-sm resize-none"
                    />
                </div>

                <div className="flex gap-3 pt-2">
                    <button type="button" onClick={resetForm} className="flex-1 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition">{t.cancel}</button>
                    <button type="submit" className="flex-1 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition">{editId ? t.btn_update : t.btn_save}</button>
                </div>
                </form>
            ) : (
                <div className="space-y-3">
                {debts.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <ArrowDownLeft className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">{t.no_debt_data || "Belum ada data."}</p>
                    </div>
                ) : (
                    debts.map((item) => (
                        <div key={item.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center group">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${item.type === 'HUTANG' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                        {item.type === 'HUTANG' ? t.my_debt : t.their_debt}
                                    </span>
                                    {item.status === 'LUNAS' && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-bold">LUNAS</span>}
                                </div>
                                <h4 className="font-bold text-gray-800 dark:text-white">{item.person_name}</h4>
                                <div className="flex flex-wrap items-center gap-3 mt-1">
                                    <p className="text-xs text-gray-400 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> 
                                        {item.due_date ? new Date(item.due_date).toLocaleDateString() : '-'}
                                    </p>
                                    {item.reminder_time && (
                                        <p className="text-xs text-blue-500 flex items-center gap-1 bg-blue-50 px-1.5 py-0.5 rounded">
                                            <Clock className="w-3 h-3" /> 
                                            {item.reminder_time}
                                        </p>
                                    )}
                                </div>
                                {item.description && (
                                    <p className="text-xs text-gray-400 mt-1 italic line-clamp-1 flex items-center gap-1">
                                        <FileText className="w-3 h-3" /> {item.description}
                                    </p>
                                )}
                            </div>
                            <div className="text-right">
                                <p className={`font-bold ${item.type === 'HUTANG' ? 'text-red-600' : 'text-green-600'}`}>{formatRp(item.amount)}</p>
                                
                                <div className="flex gap-2 justify-end mt-2">
                                    {item.status !== 'LUNAS' && (
                                        <button 
                                            onClick={() => handleEdit(item)} 
                                            className="p-1.5 bg-blue-50 text-blue-500 rounded-lg hover:bg-blue-100 transition active:scale-95"
                                        >
                                            <Pencil className="w-4 h-4"/>
                                        </button>
                                    )}

                                    <button 
                                        onClick={() => triggerAction('DELETE', item.id)} 
                                        className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition active:scale-95"
                                    >
                                        <Trash2 className="w-4 h-4"/>
                                    </button>
                                    
                                    {item.status !== 'LUNAS' && (
                                        <button 
                                            onClick={() => triggerAction('PAY', item.id)} 
                                            className="p-1.5 bg-green-50 text-green-500 rounded-lg hover:bg-green-100 transition active:scale-95"
                                        >
                                            <CheckCircle className="w-4 h-4"/>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                </div>
            )}
            </div>

            {!isAdding && (
            <div className="absolute bottom-6 right-6 z-20">
                <button onClick={() => { resetForm(); setIsAdding(true); }} className="w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg shadow-indigo-500/30 flex items-center justify-center transition-transform active:scale-95">
                    <Plus className="w-7 h-7" />
                </button>
            </div>
            )}
        </div>
        </div>

        <ConfirmModal 
            isOpen={confirmConfig.isOpen}
            onClose={() => setConfirmConfig({...confirmConfig, isOpen: false})}
            onConfirm={handleConfirmAction}
            title={confirmConfig.type === 'DELETE' ? t.del_title : t.pay_title}
            message={confirmConfig.type === 'DELETE' ? t.confirm_delete_msg : t.confirm_pay_msg}
            confirmText={confirmConfig.type === 'DELETE' ? t.yes_delete : t.yes}
            confirmButtonColor={confirmConfig.type === 'PAY' ? "bg-green-600 text-white shadow-green-500/30 hover:bg-green-700" : undefined}
        />
    </>,
    document.body
  );
}