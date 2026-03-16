import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, TrendingUp, Lock, Clock, Ban, ArrowLeft, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [statusMode, setStatusMode] = useState('login');

  useEffect(() => {
    const error = searchParams.get('error');
    const token = searchParams.get('token');

    if (token) {
        localStorage.setItem('token', token);
        toast.success("Login Berhasil!");
        window.location.href = '/'; 
        return;
    }

    if (error === 'pending') {
        setStatusMode('pending');
    } else if (error === 'blocked') {
        setStatusMode('blocked');
    } else {
        setStatusMode('login');
    }

  }, [searchParams]);

  const errorReason = searchParams.get('error');
  const getErrorMessage = () => {
    switch (errorReason) {
      case 'account_blocked':
        return {
          title: "Access Revoked",
          desc: "Your account has been disabled by an administrator. Please contact support if this is an error.",
          color: "bg-red-500/10 border-red-500/50 text-red-500"
        };
      case 'account_deleted':
        return {
          title: "Account Not Found",
          desc: "Your account data has been deleted from the system. Please re-register if you wish to use the app again.",
          color: "bg-orange-500/10 border-orange-500/50 text-orange-500"
        };
      case 'session_expired':
        return {
          title: "Sesi Berakhir",
          desc: "Waktu login Anda telah habis demi keamanan. Silakan masuk kembali.",
          color: "bg-blue-500/10 border-blue-500/50 text-blue-400"
        };
      default:
        return null;
    }
  };

  const alert = getErrorMessage();


  useEffect(() => {
    document.title = "Login - Money App";
  }, []);

  const handleBackToLogin = () => {
    navigate('/login');
    setStatusMode('login');
  };

  return (
    <div className="min-h-screen w-full bg-[#0f172a] relative overflow-hidden flex items-center justify-center font-sans selection:bg-blue-500 selection:text-white">
      
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/30 rounded-full blur-[100px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px] animate-pulse delay-1000 pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md p-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl shadow-black/50 overflow-hidden">
          
          {alert && statusMode === 'login' && (
            <div className={`mx-8 mt-6 p-4 rounded-2xl border ${alert.color} animate-in fade-in slide-in-from-top-4 duration-500`}>
              <div className="flex items-start gap-3 text-left">
                <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold">{alert.title}</p>
                  <p className="text-[11px] opacity-80 leading-relaxed">{alert.desc}</p>
                </div>
              </div>
            </div>
          )}

          <div className="p-8 pb-0 text-center">
            
            <img 
              src="/pwa-192x192.png" 
              alt="Money App Logo" 
              className="w-20 h-20 mx-auto mb-6 rounded-2xl shadow-lg transition-transform hover:scale-105 duration-300"
            />
            
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Money App</h1>
            
            {statusMode === 'login' && (
                <p className="text-gray-400 text-sm">Manage your finances smarter, safer, and more efficiently.</p>
            )}
          </div>

          <div className="p-8 space-y-6">

            {statusMode === 'login' && (
                <div className="animate-in fade-in zoom-in duration-300">
                    <div className="space-y-2 text-center mb-6">
                        <h2 className="text-white font-semibold text-lg">Welcome Back</h2>
                        <p className="text-xs text-gray-500">Please sign in to access your dashboard.</p>
                    </div>

                    <button 
                        onClick={login}
                        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-900 font-bold py-3.5 px-4 rounded-xl transition-all duration-200 transform hover:-translate-y-1 active:scale-95 shadow-lg group cursor-pointer relative z-50"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        <span>Sign in with Google</span>
                    </button>
                </div>
            )}

            {statusMode === 'pending' && (
                <div className="text-center animate-in slide-in-from-right duration-300">
                    <div className="w-16 h-16 bg-yellow-500/20 text-yellow-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                        <Clock className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Waiting for Approval</h2>
                    <p className="text-sm text-gray-400 leading-relaxed mb-6">
                        Your account has been successfully created, but requires Admin approval before use. Please contact Admin or try again later.
                    </p>
                    <button onClick={handleBackToLogin} className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-xl transition">
                        <ArrowLeft className="w-4 h-4" /> Back to Login
                    </button>
                </div>
            )}

            {statusMode === 'blocked' && (
                <div className="text-center animate-in slide-in-from-right duration-300">
                    <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                        <Ban className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Access denied</h2>
                    <p className="text-sm text-gray-400 leading-relaxed mb-6">
                        Sorry, your account has been disabled or rejected by the Administrator.
                    </p>
                    <button onClick={handleBackToLogin} className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-xl transition">
                        <ArrowLeft className="w-4 h-4" /> Back to Login
                    </button>
                </div>
            )}

          </div>

          <div className="bg-black/20 p-6 grid grid-cols-3 gap-2 border-t border-white/5">
            <FeatureItem icon={<ShieldCheck className="w-4 h-4 text-green-400"/>} text="Secure" />
            <FeatureItem icon={<TrendingUp className="w-4 h-4 text-blue-400"/>} text="Analysis" />
            <FeatureItem icon={<Lock className="w-4 h-4 text-purple-400"/>} text="Encrypted" />
          </div>
        </div>
        
        <p className="text-center text-gray-600 text-[10px] mt-6 font-mono">
           {import.meta.env.VITE_APP_VERSION || "Money App v1.0.0"}
        </p>
      </div>
    </div>
  );
}

function FeatureItem({ icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 text-center">
      <div className="p-2 rounded-lg bg-white/5">{icon}</div>
      <span className="text-[10px] font-medium text-gray-400">{text}</span>
    </div>
  );
}