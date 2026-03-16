import { useState, useEffect } from 'react';
import { X, Clock, Plus, Trash2, ArrowLeft, Pencil } from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import ConfirmModal from '@/components/ConfirmModal'; 

export default function ScheduleModal({ isOpen, onClose }) {
  const { t } = useLanguage();
  
  const [viewMode, setViewMode] = useState('LIST');
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);


  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState(null);

  const initialFormState = {
    title: '', body: '', frequency: 'DAILY', 
    day_of_week: 1, day_of_month: 1, execution_time: '08:00'
  };
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    if (isOpen && viewMode === 'LIST') {
      fetchSchedules();
    }
  }, [isOpen, viewMode]);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/schedules');
      setSchedules(res.data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleDeleteClick = (id) => {
    setIdToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!idToDelete) return;
    try {
      await api.delete(`/admin/schedules/${idToDelete}`);
      toast.success(t.success_save_schedule || "Deleted!");
      fetchSchedules();
    } catch (err) {
      toast.error("Failed to delete");
    } finally {
      setDeleteModalOpen(false);
      setIdToDelete(null);
    }
  };

  const handleEditClick = (schedule) => {
    setIsEditing(true);
    setEditingId(schedule.id);
    setFormData({
      title: schedule.title,
      body: schedule.body,
      frequency: schedule.frequency,
      day_of_week: schedule.day_of_week,
      day_of_month: schedule.day_of_month,
      execution_time: schedule.execution_time.slice(0, 5)
    });
    setViewMode('FORM');
  };

  const handleResetForm = () => {
    setFormData(initialFormState);
    setIsEditing(false);
    setEditingId(null);
    setViewMode('LIST');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
          ...formData,
          day_of_week: parseInt(formData.day_of_week),
          day_of_month: parseInt(formData.day_of_month)
      };

      if (isEditing) {
        await api.put(`/admin/schedules/${editingId}`, payload);
        toast.success(t.success_save_schedule);
      } else {
        await api.post('/admin/schedules', payload);
        toast.success(t.success_save_schedule);
      }
      
      handleResetForm();
    } catch (error) {
      toast.error(t.error_save_schedule);
    }
  };

  const formatScheduleText = (s) => {
    const time = s.execution_time.slice(0, 5);
    if (s.frequency === 'DAILY') return `${t.freq_daily} • ${time}`;
    if (s.frequency === 'WEEKLY') return `${t.freq_weekly} (${t.days_list[s.day_of_week]}) • ${time}`;
    if (s.frequency === 'MONTHLY') return `${t.freq_monthly} (${t.date_prefix} ${s.day_of_month}) • ${time}`;
    return s.frequency;
  };

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 bg-black/50 z-[50] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl animate-in zoom-in-95 flex flex-col max-h-[85vh]">
        
        <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
            {viewMode === 'LIST' ? (
                <><Clock className="w-5 h-5 text-blue-500" /> {t.modal_schedule_list}</>
            ) : (
                <>
                  {isEditing ? <Pencil className="w-5 h-5 text-orange-500" /> : <Plus className="w-5 h-5 text-green-500" />} 
                  {isEditing ? t.btn_edit_schedule : t.btn_add_schedule}
                </>
            )}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition">
            <X className="text-gray-400 w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar">
            
            {viewMode === 'LIST' && (
                <div className="space-y-3">
                    <button 
                        onClick={() => { setIsEditing(false); setViewMode('FORM'); setFormData(initialFormState); }}
                        className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition flex items-center justify-center gap-2 font-bold text-sm mb-4"
                    >
                        <Plus className="w-4 h-4" /> {t.btn_add_schedule}
                    </button>

                    {loading ? (
                        <div className="text-center py-4 text-gray-400">Loading...</div>
                    ) : schedules.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">{t.empty_schedule}</div>
                    ) : (
                        schedules.map((s) => (
                            <div key={s.id} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 flex justify-between items-start group">
                                <div className="flex-1 min-w-0 mr-3">
                                    <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm truncate">{s.title}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">{s.body}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                            s.frequency === 'DAILY' ? 'bg-blue-100 text-blue-600' :
                                            s.frequency === 'WEEKLY' ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'
                                        }`}>
                                            {formatScheduleText(s)}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => handleEditClick(s)}
                                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteClick(s.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {viewMode === 'FORM' && (
                <form onSubmit={handleSubmit} className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t.notif_label_title}</label>
                        <input required type="text" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white mt-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder={t.ph_schedule_title} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t.notif_label_message}</label>
                        <textarea required rows="2" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white mt-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            value={formData.body} onChange={e => setFormData({...formData, body: e.target.value})} placeholder={t.ph_schedule_body} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t.label_freq}</label>
                            <select className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:text-white mt-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value})}>
                                <option value="DAILY">{t.freq_daily}</option>
                                <option value="WEEKLY">{t.freq_weekly}</option>
                                <option value="MONTHLY">{t.freq_monthly}</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t.label_exec_time}</label>
                            <input type="time" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:text-white mt-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                value={formData.execution_time} onChange={e => setFormData({...formData, execution_time: e.target.value})} />
                        </div>
                    </div>

                    {formData.frequency === 'WEEKLY' && (
                        <div className="animate-in fade-in">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t.label_day_week}</label>
                            <select className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:text-white mt-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                value={formData.day_of_week} onChange={e => setFormData({...formData, day_of_week: e.target.value})}>
                                {t.days_list.map((dayName, index) => <option key={index} value={index}>{dayName}</option>)}
                            </select>
                        </div>
                    )}

                    {formData.frequency === 'MONTHLY' && (
                        <div className="animate-in fade-in">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t.label_day_month}</label>
                            <select className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:text-white mt-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                value={formData.day_of_month} onChange={e => setFormData({...formData, day_of_month: e.target.value})}>
                                {[...Array(31)].map((_, i) => <option key={i} value={i+1}>{t.date_prefix} {i+1}</option>)}
                            </select>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={handleResetForm} className="flex-1 py-3 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold transition text-xs flex items-center justify-center gap-2">
                            <ArrowLeft className="w-4 h-4" /> {t.btn_back_list}
                        </button>
                        <button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 active:scale-95 transition shadow-lg shadow-blue-500/30 text-xs">
                            {isEditing ? t.btn_update_schedule : t.btn_save_schedule}
                        </button>
                    </div>
                </form>
            )}
        </div>
      </div>
    </div>

    <ConfirmModal 
       isOpen={deleteModalOpen}
       onClose={() => setDeleteModalOpen(false)}
       onConfirm={confirmDelete}
       title={t.confirm_del_schedule_title}
       message={t.confirm_del_schedule_msg}
       confirmText={t.yes_delete}
    />
    </>
  );
}