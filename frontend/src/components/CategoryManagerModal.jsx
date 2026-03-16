import { useState, useEffect } from 'react';
import api from '@/services/api';
import { X, Trash2, Plus, Pencil, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import ConfirmModal from './ConfirmModal';

export default function CategoryManagerModal({ isOpen, onClose, onSuccess, initialTab }) {
  const { t, translateCategory } = useLanguage();

  const [activeTab, setActiveTab] = useState('EXPENSE'); 
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [isEditing, setIsEditing] = useState(null); 
  const [name, setName] = useState('');

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  useEffect(() => {
    if (isOpen) { 
        if (initialTab) {
            setActiveTab(initialTab);
        }
        fetchCategories(); 
        resetForm(); 
    }
  }, [isOpen, initialTab]);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data.data || []);
    } catch (error) { console.error("Error fetching categories", error); }
  };

  const resetForm = () => { setName(''); setIsEditing(null); };

  const handleEditClick = (cat) => {
    setIsEditing(cat.id); 
    setName(cat.name); 
    setActiveTab(cat.type); 
  };

  const requestDelete = (id) => {
    setCategoryToDelete(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;
    try {
      await api.delete(`/categories/${categoryToDelete}`);
      toast.success(t.deleteCategorySuccess || "Kategori dihapus");
      fetchCategories(); 
      if (onSuccess) onSuccess();
      setIsConfirmOpen(false); 
    } catch (error) { 
        toast.error("Gagal menghapus: " + error.message); 
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const payload = { name: name, type: activeTab };

    try {
      if (isEditing) await api.put(`/categories/${isEditing}`, payload); 
      else await api.post('/categories', payload);
      
      fetchCategories(); 
      if (onSuccess) onSuccess();
      resetForm();
    } catch (error) { toast.error("Error: " + error.message); } 
    finally { setLoading(false); }
  };

  const filteredCategories = categories.filter(c => c.type === activeTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-600" /> {t.manageCategory || "Kelola Kategori"}
          </h2>
          <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 transition"><X className="w-4 h-4 text-gray-500 dark:text-gray-300" /></button>
        </div>

        <div className="p-4 pb-0">
            <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                <button onClick={() => { setActiveTab('EXPENSE'); resetForm(); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'EXPENSE' ? 'bg-red-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>{t.expense}</button>
                <button onClick={() => { setActiveTab('INCOME'); resetForm(); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'INCOME' ? 'bg-green-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>{t.income}</button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
            {filteredCategories.length > 0 ? (
                filteredCategories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
                        
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                            {translateCategory(cat.name)}
                        </span>
                        
                        <div className="flex gap-2">
                            <button onClick={() => handleEditClick(cat)} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => requestDelete(cat.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                    </div>
                ))
            ) : (
                <div className="text-center py-8 text-gray-400 text-xs">{t.no_cat_yet || "Belum ada kategori"} ({activeTab === 'EXPENSE' ? t.expense : t.income}).</div>
            )}
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700">
            <form onSubmit={handleSubmit} className="flex gap-2">
                <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={isEditing ? (t.ph_edit_cat || "Edit kategori...") : (t.addCategoryPlaceholder || "Kategori baru...")} 
                    className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                />
                <button type="submit" disabled={loading || !name.trim()} className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition">
                    {isEditing ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </button>
                {isEditing && (
                    <button type="button" onClick={resetForm} className="bg-gray-200 text-gray-600 p-2.5 rounded-xl hover:bg-gray-300 transition">
                        <X className="w-5 h-5" />
                    </button>
                )}
            </form>
        </div>

      </div>

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmDelete}
        title={t.deleteCategoryTitle || "Hapus Kategori?"}
        message={t.deleteCategoryMsg || "Transaksi yang menggunakan kategori ini akan kehilangan labelnya."}
      />
    </div>
  );
}