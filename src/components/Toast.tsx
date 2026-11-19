import React from 'react';
import { CheckCircle, Info, X } from 'lucide-react';

interface ToastProps {
  message: string | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2.5 text-xs font-semibold max-w-md">
        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="flex-1">{message}</span>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-0.5 rounded transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
