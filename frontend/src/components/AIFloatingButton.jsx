import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Send, Bot, ChevronDown, User } from 'lucide-react';
import api from '@/services/api';
import { useLanguage } from '@/contexts/LanguageContext'; 

export default function AIFloatingButton() {
  const { language } = useLanguage(); 

  const t = {
    id: {
      greeting: "Halo, Boss!",
      subtitle: "Saya siap menganalisa data keuanganmu. Tanyakan apa saja!",
      quickAction: "⚡ Analisa Cepat",
      placeholder: "Tanya monAI... (Ex: Cukup gak uang buat beli HP?)",
      analyzing: "Sedang menganalisa...",
      error: "Maaf, monAI lagi pusing :(",
      months: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"],
      labelMonth: "BLN",
      labelYear: "THN",
      askMonthly: "Tolong analisa keuanganku bulan",
      askYearly: "Tolong analisa performa keuanganku sepanjang tahun"
    },
    en: {
      greeting: "Hello, Boss!",
      subtitle: "I'm ready to analyze your finances. Ask me anything!",
      quickAction: "⚡ Quick Analysis",
      placeholder: "Ask monAI... (Ex: Can I afford a new phone?)",
      analyzing: "Analyzing data...",
      error: "Sorry, I'm moonAI, I'm tired :(",
      months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      labelMonth: "MTH",
      labelYear: "YR",
      askMonthly: "Please analyze my finance for",
      askYearly: "Please analyze my financial performance for year"
    }
  };

  const text = t[language] || t.id;

  const [position, setPosition] = useState({ x: window.innerWidth - 70, y: window.innerHeight / 2 - 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  const offset = useRef({ x: 0, y: 0 });
  const isClick = useRef(true);
  
  const [isVisible, setIsVisible] = useState(true);

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [scope, setScope] = useState('monthly'); 

  const chatEndRef = useRef(null);

  const handleHideButton = (e) => {
    e.stopPropagation();
    setIsVisible(false);

    setTimeout(() => {
        setIsVisible(true);
    }, 5 * 60 * 1000); 
  };

  const handleStart = (clientX, clientY) => {
    isClick.current = true;
    setIsDragging(true);
    offset.current = { x: clientX - position.x, y: clientY - position.y };
  };
  const handleMove = (clientX, clientY) => {
    if (!isDragging) return;
    isClick.current = false;
    const newX = Math.min(Math.max(0, clientX - offset.current.x), window.innerWidth - 60);
    const newY = Math.min(Math.max(0, clientY - offset.current.y), window.innerHeight - 50);
    setPosition({ x: newX, y: newY });
  };
  const handleEnd = () => { setIsDragging(false); if (isClick.current) setIsOpen(true); };
  
  useEffect(() => {
    const onMouseMove = (e) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e) => handleMove(e.touches[0].clientX, e.touches[0].clientY);
    const onUp = () => handleEnd();
    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onUp);
      window.addEventListener('touchmove', onTouchMove); window.addEventListener('touchend', onUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove); window.removeEventListener('touchend', onUp);
    };
  }, [isDragging]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);


  const handleSendMessage = async (customMessage = null) => {
    const textToSend = customMessage || inputText;
    if (!textToSend && !customMessage) return;

    if (!customMessage) {
        setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
        setInputText("");
    } else {
        let triggerText = "";
        if (scope === 'yearly') {
            triggerText = `${text.askYearly} ${year}.`;
        } else {
            triggerText = `${text.askMonthly} ${text.months[month-1]} ${year}.`;
        }
        setMessages(prev => [...prev, { role: 'user', text: triggerText }]);
    }

    setLoading(true);

    try {
      const res = await api.post('/ai/analyze', {
        message: customMessage ? "" : textToSend, 
        month: scope === 'yearly' ? 0 : parseInt(month), 
        year: parseInt(year),
        scope: scope, 
        lang: language
      }, {

        skipLoading: true 
      });

      setMessages(prev => [...prev, { role: 'ai', text: res.data.analysis }]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'ai', text: text.error }]);
    } finally {
      setLoading(false);
    }
  };

  const renderMarkdown = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, idx) => {
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
            <p key={idx} className="mb-1 leading-relaxed break-words">
                {parts.map((part, i) => 
                    part.startsWith('**') && part.endsWith('**') 
                    ? <strong key={i} className="text-indigo-600 dark:text-indigo-400 font-bold">{part.slice(2, -2)}</strong> 
                    : part
                )}
            </p>
        );
    });
  };

  if (!isVisible) return null;

  return (
    <>
      <div 
        ref={dragRef} style={{ left: position.x, top: position.y }}
        className="fixed z-[60] cursor-pointer touch-none select-none"
        onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
        onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
      >
        <div className={`relative group transition-transform ${isDragging ? 'scale-95' : 'hover:scale-105 active:scale-95'}`}>
            
            <div className="absolute inset-0 bg-indigo-500 rounded-full blur opacity-30 animate-pulse"></div>
            
            <div className="h-10 px-3 bg-gradient-to-r from-indigo-700 to-purple-700 rounded-full shadow-xl flex items-center justify-center border border-white/20 relative z-10 gap-0.5 min-w-[70px]">
                <span className="text-white font-medium text-xs tracking-tight">mon</span>
                <span className="text-yellow-300 font-black text-xs italic tracking-widest">AI</span>
                <Sparkles className="w-3 h-3 text-yellow-300 ml-1 animate-pulse" />
            </div>

            <button 
                onClick={handleHideButton}

                onMouseDown={(e) => e.stopPropagation()} 
                onTouchStart={(e) => e.stopPropagation()}

                className="absolute -top-2 -left-2 z-20 w-5 h-5 bg-white/90 dark:bg-gray-800/90 text-red-400 rounded-full flex items-center justify-center shadow-sm border border-red-100 dark:border-red-900/30 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all backdrop-blur-sm"
                title="Sembunyikan monAI"
            >
                <X className="w-3 h-3" />
            </button>

        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[70] backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 w-full max-w-md h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-800">
                
                <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-900 z-10">
                    <div className="flex items-center gap-3">
                        <div className="h-8 px-2 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-sm gap-0.5">
                            <span className="text-white font-medium text-xs">mon</span>
                            <span className="text-yellow-300 font-black text-xs italic">AI</span>
                        </div>
                        
                        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                            <button 
                                onClick={() => setScope(scope === 'monthly' ? 'yearly' : 'monthly')}
                                className="px-2 py-1 bg-white dark:bg-gray-700 rounded-md text-[10px] font-bold shadow-sm text-indigo-600 dark:text-indigo-300 uppercase min-w-[35px] hover:bg-gray-50 dark:hover:bg-gray-600 transition"
                            >
                                {scope === 'monthly' ? text.labelMonth : text.labelYear}
                            </button>

                            {scope === 'monthly' && (
                                <select 
                                    value={month} 
                                    onChange={e => setMonth(e.target.value)} 
                                    className="bg-transparent text-xs font-bold px-1 outline-none cursor-pointer text-gray-700 dark:text-gray-200 border-r border-gray-300 dark:border-gray-600 appearance-none"
                                >
                                    {text.months.map((m, i) => (
                                        <option key={i} value={i + 1} className="text-black dark:text-black">
                                            {m.substring(0,3)}
                                        </option>
                                    ))}
                                </select>
                            )}

                            <select 
                                value={year} 
                                onChange={e => setYear(e.target.value)} 
                                className="bg-transparent text-xs font-bold px-1 outline-none cursor-pointer text-gray-700 dark:text-gray-200 appearance-none"
                            >
                                <option value="2024" className="text-black dark:text-black">2024</option>
                                <option value="2025" className="text-black dark:text-black">2025</option>
                                <option value="2026" className="text-black dark:text-black">2026</option>
                            </select>
                        </div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-gray-900/50 scrollbar-hide">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-60 px-6">
                            <Sparkles className="w-12 h-12 text-indigo-300 mb-3" />
                            <h4 className="font-bold text-gray-700 dark:text-gray-300">{text.greeting}</h4>
                            <p className="text-xs text-gray-500 mb-4">{text.subtitle}</p>
                            <button 
                                onClick={() => handleSendMessage("START_ANALYSIS")}
                                className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 rounded-full text-xs font-bold hover:scale-105 transition shadow-sm"
                            >
                                {text.quickAction}
                            </button>
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'ai' && (
                                    <div className="min-w-[28px] h-7 bg-indigo-600 rounded-full flex items-center justify-center mt-1 shadow-sm">
                                        <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                                    </div>
                                )}
                                <div className={`px-4 py-3 rounded-2xl text-sm shadow-sm max-w-[85%] ${
                                    msg.role === 'user' 
                                    ? 'bg-indigo-600 text-white rounded-tr-sm' 
                                    : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-tl-sm'
                                }`}>
                                    {msg.role === 'ai' ? renderMarkdown(msg.text) : msg.text}
                                </div>
                            </div>
                        ))
                    )}
                    {loading && (
                         <div className="flex gap-2 justify-start animate-pulse">
                            <div className="w-7 h-7 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                             <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-2xl rounded-tl-sm text-xs text-gray-400 border border-gray-100 dark:border-gray-700">
                                {text.analyzing}
                             </div>
                         </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                <div className="p-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
                    <form 
                        onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                        className="flex gap-2 items-center bg-gray-50 dark:bg-gray-800 p-1.5 rounded-full border border-gray-200 dark:border-gray-700 focus-within:ring-2 ring-indigo-500/50 transition-all"
                    >
                        <input 
                            type="text" 
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder={text.placeholder}
                            className="flex-1 bg-transparent px-4 py-2 outline-none text-sm text-gray-800 dark:text-white placeholder:text-gray-400"
                            disabled={loading}
                        />
                        <button 
                            type="submit" 
                            disabled={!inputText.trim() || loading}
                            className="p-2.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </form>
                </div>

            </div>
        </div>
      )}
    </>
  );
}