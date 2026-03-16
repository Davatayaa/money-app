import { useState } from 'react';
import api from '@/services/api';
import { X, Download, FileText, Calendar, Archive, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';

export default function ExportModal({ isOpen, onClose }) {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [reportType, setReportType] = useState('MONTHLY'); 
  const [exportFormat, setExportFormat] = useState('pdf');

  const appVersion = import.meta.env.VITE_APP_VERSION || "v1.0.0";

  const months = [
    { value: 1, label: t.jan || "Januari" },
    { value: 2, label: t.feb || "Februari" },
    { value: 3, label: t.mar || "Maret" },
    { value: 4, label: t.apr || "April" },
    { value: 5, label: t.may || "Mei" },
    { value: 6, label: t.jun || "Juni" },
    { value: 7, label: t.jul || "Juli" },
    { value: 8, label: t.aug || "Agustus" },
    { value: 9, label: t.sep || "September" },
    { value: 10, label: t.oct || "Oktober" },
    { value: 11, label: t.nov || "November" },
    { value: 12, label: t.dec || "Desember" },
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const getFormattedDate = () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}${month}${year}`;
  };
  const handleExport = async () => {
    setLoading(true);
    try {
      const monthParam = reportType === 'MONTHLY' ? month : 0;
      const endpoint = exportFormat === 'excel' ? '/reports/export-excel' : '/reports/monthly';
      
      const response = await api.get(endpoint, {
        params: {
          month: monthParam,
          year: year,
          lang: language,
          app_version: appVersion
        },
        responseType: 'blob'
      });

      const extension = exportFormat === 'excel' ? 'xlsx' : 'pdf';
      const url = window.URL.createObjectURL(new Blob([response.data]));
      
      const downloadDate = getFormattedDate();
      let filename = "";

      if (reportType === 'MONTHLY') {
          const selectedMonthObj = months.find(m => m.value === month);
          const monthName = selectedMonthObj ? selectedMonthObj.label : 'Report';
          
          filename = `${monthName}_${year}_Report_${downloadDate}.${extension}`;
      } else {
          filename = `${year}_Report_${downloadDate}.${extension}`;
      }

      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success(`${t.success_export} (${exportFormat.toUpperCase()})`);
      onClose();
    } catch (error) {
        if (error.response && error.response.status === 404) {
            toast.error(t.no_data);
        } else {
            console.error(error);
            toast.error(t.failed_export);
        }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className={`flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700 ${exportFormat === 'excel' ? 'bg-green-600' : 'bg-blue-600'} transition-colors duration-300`}>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            {exportFormat === 'excel' ? <FileSpreadsheet className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            {t.export_menu} {exportFormat === 'excel' ? 'Excel' : 'PDF'}
          </h2>
          <button onClick={onClose} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-6">

            <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">{t.format_file}</label>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => setExportFormat('pdf')}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${exportFormat === 'pdf' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-gray-100 dark:border-gray-700 text-gray-500'}`}
                    >
                        <FileText className="w-5 h-5" />
                        <span className="text-sm font-bold">{t.pdf_doc}</span>
                    </button>
                    <button 
                        onClick={() => setExportFormat('excel')}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${exportFormat === 'excel' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'border-gray-100 dark:border-gray-700 text-gray-500'}`}
                    >
                        <FileSpreadsheet className="w-5 h-5" />
                        <span className="text-sm font-bold">{t.excel_file}</span>
                    </button>
                </div>
            </div>
            
            <div className="flex bg-gray-100 dark:bg-gray-700 p-1.5 rounded-xl relative">
                <button 
                    onClick={() => setReportType('MONTHLY')} 
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 relative z-10
                        ${reportType === 'MONTHLY' 
                            ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-white shadow-sm' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                >
                    <Calendar className="w-4 h-4"/> {t.monthly}
                </button>
                <button 
                    onClick={() => setReportType('YEARLY')} 
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 relative z-10
                        ${reportType === 'YEARLY' 
                            ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-white shadow-sm' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                >
                    <Archive className="w-4 h-4"/> {t.yearly}
                </button>
            </div>

            <div className="space-y-4">
                {reportType === 'MONTHLY' && (
                    <div className="space-y-2 animate-in slide-in-from-left-2 fade-in duration-300">
                        <label className="text-xs font-bold text-gray-500 uppercase">{t.select_month}</label>
                        <div className="grid grid-cols-3 gap-2">
                            {months.map((m) => (
                                <button
                                    key={m.value}
                                    onClick={() => setMonth(m.value)}
                                    className={`p-2 text-xs font-bold rounded-lg border transition ${month === m.value ? 'bg-blue-50 border-blue-500 text-blue-600' : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">{t.select_year}</label>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {years.map((y) => (
                            <button
                                key={y}
                                onClick={() => setYear(y)}
                                className={`px-4 py-2 text-sm font-bold rounded-lg border transition whitespace-nowrap ${year === y ? 'bg-blue-50 border-blue-500 text-blue-600' : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                            >
                                {y}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <button 
                onClick={handleExport} 
                disabled={loading}
                className={`w-full py-3.5 text-white rounded-xl font-bold shadow-lg active:scale-95 transition flex items-center justify-center gap-2
                    ${exportFormat === 'excel' 
                        ? 'bg-green-600 hover:bg-green-700 shadow-green-500/30' 
                        : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'
                    }
                    ${loading ? 'opacity-70 cursor-not-allowed' : ''}
                `}
            >
                {loading ? t.generating : (
                    <>
                        <Download className="w-5 h-5" /> {t.download} {exportFormat === 'excel' ? 'Excel' : 'PDF'}
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
}