import { useState } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';

export default function AddCategoryModal({ isOpen, onClose, onSuccess, defaultType }) {
  const [name, setName] = useState('');
  
  const defaultIcon = "fa-tag"; 
  const defaultColor = defaultType === 'EXPENSE' ? '#EF4444' : '#10B981';

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:8080/api/v1/categories', {
        name,
        type: defaultType,
        icon: defaultIcon,
        color: defaultColor
      });
      
      alert("Kategori berhasil dibuat!");
      setName('');
      onSuccess();
      onClose();
    } catch (error) {
      alert("Gagal buat kategori: " + error.response?.data?.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-5 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95">
        
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-800 dark:text-white">Buat Kategori ({defaultType === 'EXPENSE' ? 'Pengeluaran' : 'Pemasukan'})</h3>
          <button onClick={onClose} className="p-1 bg-gray-100 dark:bg-gray-700 rounded-full">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Nama Kategori</label>
            <input
              autoFocus
              type="text"
              placeholder="Contoh: Bensin, Gajian, Kopi"
              required
              className="w-full mt-1 p-3 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white rounded-xl border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-blue-700 transition">
            SIMPAN
          </button>
        </form>
      </div>
    </div>
  );
}