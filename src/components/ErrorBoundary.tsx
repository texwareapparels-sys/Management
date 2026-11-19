import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = window.location.pathname;
    }
  };

  private handleResetCache = () => {
    if (typeof window !== 'undefined') {
      try {
        // Clear session keys that might cause deserialization errors without losing core data
        localStorage.removeItem('texware_worker_session');
        localStorage.removeItem('texware_investor_session');
        localStorage.removeItem('texware_selected_detail_id');
      } catch {}
      window.location.href = window.location.pathname;
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-white">
                অ্যাপে সাময়িক সমস্যা দেখা দিয়েছে
              </h2>
              <p className="text-sm text-slate-300">
                চিন্তার কোনো কারণ নেই, আপনার কারখানার ডেটাবেসের সকল তথ্য সম্পূর্ণ সুরক্ষিত রয়েছে। নিচের বোতামে ক্লিক করে অ্যাপটি পুনরায় লোড করুন।
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-left">
                <p className="text-[11px] font-mono text-rose-400 break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-98 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>পুনরায় লোড করুন (Reload)</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
              >
                <Home className="w-4 h-4 text-slate-300" />
                <span>প্রধান স্ক্রিনে ফিরে যান (Home)</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetCache}
                className="w-full py-2 px-3 text-[11px] text-slate-400 hover:text-amber-300 transition underline underline-offset-4 cursor-pointer"
              >
                ক্যাশ মেরামত ও পুনরায় চালু করুন
              </button>
            </div>

            <div className="pt-2 border-t border-slate-700/60 flex items-center justify-center gap-1.5 text-xs text-slate-400">
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
              <span>টেক্স ওয়্যার অ্যাপারেলস — সিস্টেম সুরক্ষিত</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
