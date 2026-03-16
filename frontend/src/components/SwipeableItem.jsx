import { useState, useRef } from 'react';
import { Trash2 } from 'lucide-react'; 

export default function SwipeableItem({ children, onTriggerDelete, onClick, type }) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  
  const isSwiping = useRef(false); 

  const itemRef = useRef(null);

  const handleTouchStart = (e) => { 
    setStartX(e.targetTouches[0].clientX); 
    setIsDragging(true); 
    isSwiping.current = false;
  };

  const handleTouchMove = (e) => { 
    if (!isDragging) return; 
    const currentX = e.targetTouches[0].clientX;
    const diff = currentX - startX; 
    
    if (Math.abs(diff) > 5) isSwiping.current = true;

    if (diff < 0 && diff > -150) setTranslateX(diff); 
  };

  const handleTouchEnd = () => { 
    setIsDragging(false); 
    handleDragEnd(); 
  };
  
  const handleMouseDown = (e) => { 
    setStartX(e.clientX); 
    setIsDragging(true); 
    isSwiping.current = false;
  };

  const handleMouseMove = (e) => { 
    if (!isDragging) return; 
    const diff = e.clientX - startX; 

    if (Math.abs(diff) > 5) {
      isSwiping.current = true;
    }

    if (diff < 0 && diff > -150) setTranslateX(diff); 
  };

  const handleMouseUp = () => { 
    setIsDragging(false); 
    handleDragEnd(); 
  };

  const handleMouseLeave = () => { 
    if (isDragging) { 
      setIsDragging(false); 
      setTranslateX(0); 
    } 
  };

  const handleDragEnd = () => { 
    if (translateX < -80) { 
      onTriggerDelete(); 
      setTranslateX(0); 
    } else { 
      setTranslateX(0); 
    }
    
    setTimeout(() => {
        isSwiping.current = false;
    }, 100);
  };

  const handleClick = (e) => { 

    if (isSwiping.current) {
        e.stopPropagation();
        return;
    }
    onClick(); 
  };

  const borderClass = type === 'EXPENSE' ? 'border-red-100 dark:border-red-900/50' : 'border-green-100 dark:border-green-900/50';

  return (
    <div className="relative overflow-hidden rounded-2xl mb-2 select-none">
      
      <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-6 rounded-2xl"><Trash2 className="text-white w-6 h-6" /></div>
      
      <div
        ref={itemRef}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className={`relative bg-white dark:bg-gray-800 py-2 px-3 rounded-xl shadow-sm border ${borderClass} transition-transform duration-100 ease-out z-10 cursor-pointer active:scale-[0.99]`}
        style={{ transform: `translateX(${translateX}px)` }}
      >
        {children}
      </div>
    </div>
  );
}