import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

export const loaderState = {
  onChange: null,
  show: () => loaderState.onChange?.(true),
  hide: () => loaderState.onChange?.(false),
};

export default function GlobalLoader() {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loaderState.onChange = (status) => setIsLoading(status);
    
    return () => { loaderState.onChange = null; };
  }, []);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-200">
      
      <div className="bg-white dark:bg-gray-800 px-6 py-4 rounded-2xl shadow-2xl flex flex-col items-center gap-3 min-w-[120px]">
        
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        
        <span className="text-xs font-bold text-gray-600 dark:text-gray-300 tracking-wide uppercase">
          Processing...
        </span>
      </div>
    </div>
  );
}