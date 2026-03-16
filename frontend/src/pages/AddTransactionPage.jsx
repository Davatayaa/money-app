import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '@/services/api';
import { ArrowLeft, Check, ChevronDown, ChevronUp, Wallet, Tag, Camera, Trash2, Edit2, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import CategoryManagerModal from '../components/CategoryManagerModal';
import WalletManagerModal from '../components/WalletManagerModal'; 
import { useLanguage } from '../contexts/LanguageContext';
import imageCompression from 'browser-image-compression';

import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

export default function AddTransaction() {
  const { t, translateCategory } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  
  const initialData = location.state?.transaction || null;

  const [type, setType] = useState('EXPENSE');
  const [amount, setAmount] = useState('');
  
  const [walletId, setWalletId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null);
  const [isCompressing, setIsCompressing] = useState(false);
  
  const [isImageFullscreen, setIsImageFullscreen] = useState(false);

  const [wallets, setWallets] = useState([]);
  const [categories, setCategories] = useState([]); 
  const [monthlyTransactions, setMonthlyTransactions] = useState([]);

  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isWalletManagerOpen, setIsWalletManagerOpen] = useState(false);

  const [isWalletSectionOpen, setIsWalletSectionOpen] = useState(true);
  const [isCategorySectionOpen, setIsCategorySectionOpen] = useState(true);

  const isExpense = type === 'EXPENSE';
  const textWalletLabel = isExpense ? (t.ph_sourceFund || "Sumber Dana") : (t.ph_destWallet || "Masuk ke Dompet");
  const textCategoryLabel = isExpense ? (t.ph_catExpense || "Kategori Pengeluaran") : (t.ph_catIncome || "Kategori Pemasukan");

  useEffect(() => {
    fetchData();
    if (initialData) {
      setType(initialData.type);
      setAmount(initialData.amount ? initialData.amount.toLocaleString('id-ID') : '');
      setWalletId(initialData.wallet_id);
      setCategoryId(initialData.category_id);
      setDate(new Date(initialData.date).toISOString().split('T')[0]);
      setDescription(initialData.description || '');
      
      if (initialData.photo_url) {
          const filename = initialData.photo_url.split('/').pop(); 
          loadSecureImage(filename);
      }

      setIsWalletSectionOpen(false);
      setIsCategorySectionOpen(false);
    }
  }, [initialData]);

  const loadSecureImage = async (filename) => {
      try {
          const response = await api.get(`/transactions/photo/${filename}`, { 
              responseType: 'blob' 
          });
          const objectUrl = URL.createObjectURL(response.data);
          setPhotoPreview(objectUrl);
      } catch (error) {
          console.error("Gagal load foto secure:", error);
      }
  };

  useEffect(() => {
      fetchMonthlyTransactions();
  }, [date]);

  const fetchData = async () => {
    try {
      const [resWallets, resCats] = await Promise.all([
        api.get('/wallets'),
        api.get('/categories')
      ]);
      setWallets(resWallets.data.data || []);
      setCategories(resCats.data.data || []);
    } catch (error) {
      console.error("Gagal load data", error);
    }
  };

  const fetchMonthlyTransactions = async () => {
      try {
          const selectedDate = new Date(date);
          const month = selectedDate.getMonth() + 1;
          const year = selectedDate.getFullYear();
          const res = await api.get(`/transactions?month=${month}&year=${year}`);
          setMonthlyTransactions(res.data.data || []);
      } catch (error) {
          console.error("Gagal load transaksi bulanan", error);
      }
  };

  const getWalletMonthFlow = (wId) => {
      const walletTrx = monthlyTransactions.filter(t => t.wallet_id === wId);
      let income = 0;
      let expense = 0;
      walletTrx.forEach(t => {
          if (t.type === 'INCOME') income += t.amount;
          else if (t.type === 'EXPENSE') expense += t.amount;
      });
      return income - expense;
  };

  const handleSwitchType = (newType) => {
    setType(newType);
    setCategoryId('');
    setIsCategorySectionOpen(true); 
  };

  const handleAmountChange = (e) => {
    const value = e.target.value;
    const rawValue = value.replace(/\D/g, '');
    if (rawValue === '') setAmount('');
    else setAmount(Number(rawValue).toLocaleString('id-ID'));
  };

  const handlePhotoChange = async (e) => {
    const files = e.target.files;

    if (files.length > 1) {
        toast.error(t.error_single_photo || "Hanya boleh upload 1 foto bukti transaksi!");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return; 
    }

    const file = files[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            toast.error("File harus berupa gambar!");
            return;
        }

        try {
            setIsCompressing(true); 
            const options = {
                maxSizeMB: 1,              
                maxWidthOrHeight: 1920,    
                useWebWorker: true,        
                fileType: "image/jpeg"     
            };
            const compressedFile = await imageCompression(file, options);
            setPhoto(compressedFile); 
            setPhotoPreview(URL.createObjectURL(compressedFile)); 
            toast.success("Foto berhasil diproses!");
        } catch (error) {
            console.error("Gagal kompres foto:", error);
            toast.error("Gagal memproses foto, silakan coba lagi.");
        } finally {
            setIsCompressing(false); 
        }
    }
  };

  const clearPhoto = (e) => {
      e.stopPropagation(); 
      setPhoto(null);
      setPhotoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isCompressing) {
        toast.loading("Sedang memproses foto, tunggu sebentar...");
        return;
    }
    if (!walletId) { toast.error(t.selectWalletAlert || "Pilih dompet dulu"); return; }
    if (!categoryId) { toast.error(t.selectCategoryAlert || "Pilih kategori dulu"); return; } 

    const cleanAmount = parseInt(amount.replace(/\./g, '')) || 0;
    const isoDate = new Date(date).toISOString(); 

    try {
      if (initialData) {
        const payload = {
            type, 
            amount: cleanAmount, 
            wallet_id: parseInt(walletId),
            category_id: parseInt(categoryId), 
            date: isoDate, 
            description
        };
        await api.put(`/transactions/${initialData.id}`, payload);
        toast.success(t.trxUpdated || "Transaksi berhasil diupdate!"); 
      } else {
        const formData = new FormData();
        formData.append('type', type);
        formData.append('amount', cleanAmount);
        formData.append('wallet_id', walletId);
        formData.append('category_id', categoryId);
        formData.append('date', isoDate);
        formData.append('description', description);
        if (photo) formData.append('photo', photo); 

        await api.post('/transactions', formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success(t.trxSaved || "Transaksi berhasil disimpan!"); 
      }
      navigate(-1); 
    } catch (error) {
      console.error(error);
      toast.error("Error: " + (error.response?.data?.message || error.message));
    } 
  };

  const filteredCategories = categories.filter(c => c.type === type);
  const selectedWallet = wallets.find(w => w.id === parseInt(walletId));
  const selectedWalletName = selectedWallet ? selectedWallet.name : (t.chooseWallet || "Pilih Dompet");
  const selectedWalletFlow = selectedWallet ? getWalletMonthFlow(selectedWallet.id) : 0;
  const rawSelectedCategory = categories.find(c => c.id === parseInt(categoryId));
  const selectedCategoryName = rawSelectedCategory ? translateCategory(rawSelectedCategory.name) : (t.chooseCategory || "Pilih Kategori");

  return (
    <>
      <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col animate-in slide-in-from-bottom-10 duration-300">
        
        <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 px-4 pt-14 pb-4 flex items-center justify-between">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-white" />
            </button>
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">
                {initialData ? (t.editTransaction || "Edit Transaksi") : (t.addTransaction || "Transaksi Baru")}
            </h1>
            <div className="w-8"></div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 pb-32">
            
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-6">
                <button type="button" onClick={() => handleSwitchType('EXPENSE')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${type === 'EXPENSE' ? 'bg-red-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>{t.expense || "Pengeluaran"}</button>
                <button type="button" onClick={() => handleSwitchType('INCOME')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${type === 'INCOME' ? 'bg-green-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>{t.income || "Pemasukan"}</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                
                <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 mb-0 block tracking-wider">{t.amount || "JUMLAH"}</label>
                    <div className="relative">
                        <input 
                            type="text" 
                            value={amount} 
                            onChange={handleAmountChange} 
                            className="w-full text-4xl font-bold text-gray-800 dark:text-white bg-transparent border-b border-gray-200 dark:border-gray-700 outline-none pb-1 placeholder-gray-300" 
                            placeholder="0" 
                            inputMode="numeric" 
                            autoFocus={!initialData} 
                            required 
                        />
                    </div>
                </div>

                <div className="flex flex-col items-center"> 
                    <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block tracking-wider">{t.date || "TANGGAL"}</label>
                    <input 
                        type="date" 
                        value={date} 
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full sm:w-auto min-w-[250px] p-2 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 outline-none text-gray-700 dark:text-white font-bold text-center" 
                        required 
                    />
                </div>

                <div className="border-t border-b border-gray-100 dark:border-gray-800 py-3">
                    <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                             <div className={`p-2 rounded-full ${walletId ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                <Wallet className="w-5 h-5" />
                             </div>
                             <div>
                                 <p className="text-[10px] text-gray-400 font-bold uppercase">{textWalletLabel}</p>
                                 <p className="text-sm font-bold text-gray-800 dark:text-white">{selectedWalletName}</p>
                             </div>
                        </div>

                        <div className="flex items-center gap-1">
                             <button type="button" onClick={() => setIsWalletManagerOpen(true)} className="p-2 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition">
                                <Edit2 className="w-4 h-4" />
                             </button>
                             <button type="button" onClick={() => setIsWalletSectionOpen(!isWalletSectionOpen)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
                                {isWalletSectionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {isWalletSectionOpen && (
                        <div className="grid grid-cols-2 gap-2 mt-2 animate-in slide-in-from-top-2 fade-in">
                            {wallets.map(w => {
                                const isSelected = parseInt(walletId) === w.id;
                                const flow = getWalletMonthFlow(w.id);
                                return (
                                    <button
                                        key={w.id} type="button" onClick={() => { setWalletId(w.id); setIsWalletSectionOpen(false); }}
                                        className={`p-2 rounded-xl border text-left transition relative overflow-hidden ${isSelected ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 dark:bg-blue-900/20' : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'}`}
                                    >
                                        <div className="text-sm font-bold text-gray-800 dark:text-white truncate">{w.name}</div>
                                        <div className={`text-[10px] font-medium ${flow >= 0 ? 'text-green-500' : 'text-red-500'}`}>{t.remaining} {flow.toLocaleString('id-ID')}</div>
                                        {isSelected && <Check className="w-4 h-4 absolute top-1 right-1 text-blue-600"/>}
                                    </button>
                                );
                            })}
                            
                            {wallets.length === 0 && (
                                <button type="button" onClick={() => setIsWalletManagerOpen(true)} className="p-2 rounded-xl border border-dashed border-gray-300 flex items-center justify-center gap-2 text-xs font-bold text-gray-400 hover:bg-gray-50">
                                    <Wallet className="w-4 h-4" /> {t.no_wallet_yet}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
                     <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                             <div className={`p-2 rounded-full ${categoryId ? (type === 'EXPENSE' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600') : 'bg-gray-100 text-gray-400'}`}>
                                <Tag className="w-5 h-5" />
                             </div>
                             <div>
                                 <p className="text-[10px] text-gray-400 font-bold uppercase">{textCategoryLabel}</p>
                                 <p className="text-sm font-bold text-gray-800 dark:text-white">{selectedCategoryName}</p>
                             </div>
                        </div>

                        <div className="flex items-center gap-1">
                             <button type="button" onClick={() => setIsCategoryManagerOpen(true)} className="p-2 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition">
                                <Edit2 className="w-4 h-4" />
                             </button>
                             <button type="button" onClick={() => setIsCategorySectionOpen(!isCategorySectionOpen)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
                                {isCategorySectionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {isCategorySectionOpen && (
                        <div className="grid grid-cols-3 gap-2 mt-2 animate-in slide-in-from-top-2 fade-in">
                            {filteredCategories.map(c => {
                                const isSelected = parseInt(categoryId) === c.id;
                                const activeClass = type === 'EXPENSE' ? 'bg-red-100 border-red-500 text-red-700' : 'bg-green-100 border-green-500 text-green-700';
                                return (
                                    <button key={c.id} type="button" onClick={() => { setCategoryId(c.id); setIsCategorySectionOpen(false); }} className={`p-2 rounded-xl border text-xs font-bold transition truncate ${isSelected ? activeClass : 'bg-white border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'}`}>
                                        {translateCategory(c.name)}
                                    </button>
                                );
                            })}
                            
                            {filteredCategories.length === 0 && (
                                <button type="button" onClick={() => setIsCategoryManagerOpen(true)} className="p-2 rounded-xl border border-dashed border-gray-300 flex items-center justify-center gap-1 text-xs font-bold text-gray-400 hover:bg-gray-50 col-span-3">
                                    <Tag className="w-3 h-3" /> {t.no_category_yet}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block tracking-wider">{t.noteOptional || "CATATAN"}</label>
                    <input 
                        type="text" 
                        value={description} 
                        onChange={(e) => setDescription(e.target.value)} 
                        placeholder={type === 'EXPENSE' ? (t.ph_noteExp || "Contoh: Beli Nasi, Bensin...") : (t.ph_noteInc || "Contoh: Gaji, Bonus, THR...")} 
                        className="w-full p-2 bg-gray-50 dark:bg-gray-800 rounded-xl border-none outline-none text-gray-700 dark:text-white font-medium" 
                    />
                </div>

                {photoPreview && (
                    <div 
                        className="relative w-full h-48 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 group mt-4 bg-gray-50 dark:bg-gray-800 cursor-pointer"
                        onClick={() => setIsImageFullscreen(true)} 
                    >
                        <img src={photoPreview} alt="Bukti" className="w-full h-full object-cover" />
                        
                        {isCompressing && (
                            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white text-xs font-bold gap-2">
                                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Mengompres Foto...
                            </div>
                        )}

                        <button type="button" onClick={clearPhoto} className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-red-500 transition z-10">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )}
                
                <div className="h-20"></div> 
            </form>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 p-4 pb-6 flex gap-3 z-50">
             <input type="file" accept="image/*" multiple={false} ref={fileInputRef} onChange={handlePhotoChange} className="hidden" />
             
             <button type="button" onClick={() => fileInputRef.current.click()} disabled={isCompressing} className="p-3 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition disabled:opacity-50">
                <Camera className="w-6 h-6" />
             </button>

             <button onClick={handleSubmit} disabled={isCompressing} className={`flex-1 text-white font-bold text-base rounded-2xl shadow-xl active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed ${type === 'EXPENSE' ? 'bg-red-500' : 'bg-green-500'}`}>
                {isCompressing ? 'Memproses...' : (initialData ? (t.updateTransaction || "Update") : (t.saveTransaction || "SIMPAN"))}
            </button>
        </div>

      </div>

      {isImageFullscreen && photoPreview && (
          <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-200">
              
              <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                  <div className="text-white font-medium drop-shadow-md pointer-events-auto">Preview</div>
                  <button 
                    onClick={() => setIsImageFullscreen(false)} 
                    className="bg-white/20 text-white p-2 rounded-full hover:bg-white/40 backdrop-blur-sm pointer-events-auto"
                  >
                      <X className="w-6 h-6" />
                  </button>
              </div>

              <div className="flex-1 w-full h-full overflow-hidden flex items-center justify-center">
                  <TransformWrapper
                    initialScale={1}
                    minScale={1}
                    maxScale={5}
                    centerOnInit={true}
                  >
                    {({ zoomIn, zoomOut, resetTransform }) => (
                      <>
                        <TransformComponent 
                            wrapperStyle={{ width: "100vw", height: "100vh" }}
                            contentStyle={{ width: "100vw", height: "100vh" }}
                        >
                          <img 
                            src={photoPreview} 
                            alt="Fullscreen Bukti" 
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                          />
                        </TransformComponent>

                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4 z-50 bg-black/50 p-2 rounded-full backdrop-blur-md border border-white/10">
                            <button onClick={() => zoomOut()} className="p-3 bg-white/10 text-white rounded-full hover:bg-white/30 active:scale-95 transition">
                                <ZoomOut className="w-6 h-6"/>
                            </button>
                            <button onClick={() => resetTransform()} className="p-3 bg-white/10 text-white rounded-full hover:bg-white/30 active:scale-95 transition">
                                <RotateCcw className="w-6 h-6"/>
                            </button>
                            <button onClick={() => zoomIn()} className="p-3 bg-white/10 text-white rounded-full hover:bg-white/30 active:scale-95 transition">
                                <ZoomIn className="w-6 h-6"/>
                            </button>
                        </div>
                      </>
                    )}
                  </TransformWrapper>
              </div>
          </div>
      )}

      <CategoryManagerModal isOpen={isCategoryManagerOpen} onClose={() => setIsCategoryManagerOpen(false)} onSuccess={() => { fetchData(); }} initialTab={type} />
      <WalletManagerModal isOpen={isWalletManagerOpen} onClose={() => setIsWalletManagerOpen(false)} onSuccess={() => { fetchData(); }} currentDate={date} />
    </>
  );
}