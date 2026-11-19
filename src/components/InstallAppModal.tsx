import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Download,
  X,
  Share2,
  MoreVertical,
  PlusSquare,
  CheckCircle2,
  Laptop,
  Sparkles,
  ShieldCheck,
  Layers,
  ArrowRight,
  Copy,
  Check,
  Globe,
  Info,
  HelpCircle,
  ExternalLink
} from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  appName?: string;
  appSubtitle?: string;
  mode?: 'worker' | 'admin';
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  isOpen,
  onClose,
  appName,
  appSubtitle,
  mode = 'worker'
}) => {
  const [selectedApp, setSelectedApp] = useState<'worker' | 'admin'>(mode);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(() => {
    return typeof window !== 'undefined' ? (window as any).__deferredInstallPrompt : null;
  });
  const [isInstalled, setIsInstalled] = useState(false);
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'computer'>('android');
  const [copied, setCopied] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [guideHighlighted, setGuideHighlighted] = useState(false);

  // Keep selectedApp synchronized with incoming mode prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedApp(mode === 'worker' ? 'worker' : selectedApp);
    }
  }, [isOpen, mode]);

  // Detect platform & in-app browsers (Telegram, Facebook, WhatsApp, etc.)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect standalone mode (already installed on phone)
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsInstalled(true);
    }

    const ua = (window.navigator.userAgent || '').toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua);
    const isAndroidDevice = /android/.test(ua);
    const inApp = /fban|fbav|instagram|messenger|telegram|whatsapp|line|bytedance/i.test(ua);
    setIsInAppBrowser(inApp);

    if (isIOSDevice) {
      setActiveTab('ios');
    } else if (isAndroidDevice) {
      setActiveTab('android');
    } else {
      setActiveTab('computer');
    }

    if ((window as any).__deferredInstallPrompt) {
      setDeferredPrompt((window as any).__deferredInstallPrompt);
    }

    const handlePromptReady = () => {
      if ((window as any).__deferredInstallPrompt) {
        setDeferredPrompt((window as any).__deferredInstallPrompt);
      }
    };

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      (window as any).__deferredInstallPrompt = e;
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      (window as any).__deferredInstallPrompt = null;
    };

    window.addEventListener('pwa_prompt_ready', handlePromptReady);
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('pwa_prompt_ready', handlePromptReady);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (!isOpen) return null;

  const currentPath = typeof window !== 'undefined' ? (window.location.pathname || '').toLowerCase() : '';
  const currentSearch = typeof window !== 'undefined' ? (window.location.search || '').toLowerCase() : '';
  const isOnWorkerRoute = currentPath.includes('worker') || currentSearch.includes('worker');

  const isWorkerSelected = mode === 'worker' ? true : selectedApp === 'worker';
  const targetTitle = isWorkerSelected ? 'টেক্স ওয়ার শ্রমিক অ্যাপ' : 'টেক্স ওয়ার অ্যাডমিন অ্যাপ';
  const targetShortName = isWorkerSelected ? 'শ্রমিক অ্যাপ' : 'টেক্স ওয়ার';
  const targetDesc = isWorkerSelected
    ? 'শ্রমিকদের নিজস্ব হাজিরা ও বেতন বিবরণী দেখার মোবাইল অ্যাপ'
    : 'কারখানা পরিচালনা, বেতন হিসাব ও এইচআর ব্যবস্থাপনা পোর্টাল';

  const handleInstallClick = async () => {
    const prompt = deferredPrompt || (typeof window !== 'undefined' ? (window as any).__deferredInstallPrompt : null);
    if (prompt) {
      try {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
        if (typeof window !== 'undefined') {
          (window as any).__deferredInstallPrompt = null;
        }
        return;
      } catch (e) {
        console.warn("Install prompt error:", e);
      }
    }

    // If deferredPrompt is not available (e.g. Chrome 3-dots needed or iOS Safari)
    setGuideHighlighted(true);
    setTimeout(() => setGuideHighlighted(false), 3000);
  };

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    const origin = window.location.origin;
    const directUrl = isWorkerSelected ? `${origin}/?mode=worker` : `${origin}/?mode=admin`;
    navigator.clipboard.writeText(directUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  const handleOpenInChrome = () => {
    if (typeof window === 'undefined') return;
    const host = window.location.host;
    const pathWithQuery = isWorkerSelected ? '/?mode=worker' : '/?mode=admin';
    // Android intent URL to open Google Chrome directly from in-app browsers
    window.location.href = `intent://${host}${pathWithQuery}#Intent;scheme=https;package=com.android.chrome;end`;
  };

  const handleNavigateToApp = (target: 'worker' | 'admin') => {
    if (typeof window === 'undefined') return;
    if (target === 'worker') {
      window.location.href = '/texwareworker';
    } else {
      window.location.href = '/?mode=admin';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className={`p-4 sm:p-5 text-white relative transition-all duration-300 ${
          isWorkerSelected
            ? 'bg-gradient-to-r from-teal-800 via-emerald-800 to-cyan-900'
            : 'bg-gradient-to-r from-blue-800 via-indigo-900 to-slate-900'
        }`}>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-13 h-13 rounded-2xl bg-white p-1 flex items-center justify-center border-2 border-amber-400 shadow-md overflow-hidden shrink-0">
              <img src="/logo.png" alt="App Logo" className="w-full h-full object-contain rounded-xl" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-base sm:text-lg font-black tracking-tight">
                  {targetTitle}
                </h3>
                <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                  {isWorkerSelected ? '📱 শ্রমিক অ্যাপ' : '👔 অ্যাডমিন অ্যাপ'}
                </span>
              </div>
              <p className="text-xs text-slate-200 mt-0.5 leading-snug">
                {targetDesc}
              </p>
            </div>
          </div>

          {/* In-App Browser Warning & Direct Chrome Switcher */}
          {isInAppBrowser && (
            <div className="p-3 bg-amber-400/20 border border-amber-300/40 rounded-2xl text-amber-100 text-xs flex flex-col gap-2 mt-3 shadow-inner">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <b className="text-white block font-black">টেলিগ্রাম বা মেসেঞ্জারের ইন-অ্যাপ ব্রাউজার শনাক্ত হয়েছে!</b>
                  <span className="text-[11px] leading-relaxed text-amber-100">
                    মেসেঞ্জার বা টেলিগ্রামের নিজস্ব ব্রাউজারে সরাসরি অ্যাপ ইনস্টল ব্লক থাকে। অ্যাপটি সরাসরি ফোনে ইনস্টল করতে নিচে চাপ দিয়ে <b>গুগল ক্রোম (Chrome)</b> ব্রাউজারে খুলুন।
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenInChrome}
                className="w-full py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
              >
                <Globe className="w-4 h-4 text-slate-950" />
                <span>🌐 সরাসরি গুগল ক্রোম (Google Chrome) ব্রাউজারে খুলুন</span>
              </button>
            </div>
          )}

          {/* Dual-App Switcher (শুধুমাত্র অ্যাডমিন মোডে উভয় অ্যাপের অপশন দেখাবে, শ্রমিকদের সামনে অ্যাডমিন অ্যাপ আসবে না) */}
          {mode === 'admin' && (
            <div className="mt-4 pt-3 border-t border-white/20">
              <p className="text-[11px] font-bold text-amber-300 flex items-center gap-1 mb-2">
                <Layers className="w-3.5 h-3.5" />
                <span>একই ফোনে দুটি অ্যাপই ডাউনলোড ও ইনস্টল করতে পারবেন:</span>
              </p>
              <div className="grid grid-cols-2 gap-2 bg-black/25 p-1 rounded-2xl border border-white/15">
                <button
                  type="button"
                  onClick={() => setSelectedApp('worker')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    isWorkerSelected
                      ? 'bg-amber-400 text-slate-950 shadow-md scale-[1.02]'
                      : 'text-slate-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>১. শ্রমিক অ্যাপ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedApp('admin')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    !isWorkerSelected
                      ? 'bg-amber-400 text-slate-950 shadow-md scale-[1.02]'
                      : 'text-slate-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>২. অ্যাডমিন অ্যাপ</span>
                </button>
              </div>
            </div>
          )}

          {/* Main Action Install Card */}
          <div className="mt-3.5 space-y-2">
            {isInstalled ? (
              <div className="py-2.5 px-3 rounded-xl bg-emerald-500/30 border border-emerald-300/40 text-emerald-100 flex items-center justify-center gap-2 text-xs font-black">
                <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>✓ {targetShortName} ইতোমধ্যে আপনার ডিভাইসে ইনস্টল করা আছে!</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleInstallClick}
                className={`w-full py-3 px-4 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95 cursor-pointer ${
                  deferredPrompt
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 ring-2 ring-amber-300/60'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-white border border-emerald-300/40'
                }`}
              >
                <Download className="w-4.5 h-4.5 shrink-0" />
                <span>
                  {deferredPrompt
                    ? `সরাসরি এক-ক্লিকে ${targetShortName} ফোনে ইনস্টল করুন (Install Now)`
                    : `📱 ফোনে ${targetShortName} ডাউনলোড ও ইনস্টল করার উপায়`}
                </span>
              </button>
            )}

            {/* Quick Helper Tools (Copy Link & Chrome Shortcut) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 py-1.5 px-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                title="অ্যাপের সরাসরি লিঙ্ক কপি করুন"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '✓ লিংক কপি হয়েছে!' : 'লিংক কপি করুন'}</span>
              </button>
              <button
                type="button"
                onClick={handleOpenInChrome}
                className="flex-1 py-1.5 px-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                title="গুগল ক্রোম ব্রাউজারে খুলুন"
              >
                <Globe className="w-3.5 h-3.5 text-teal-300" />
                <span>ক্রোম এ খুলুন</span>
              </button>
            </div>
          </div>

          {/* Navigation helpers for Admin mode only */}
          {mode === 'admin' && isWorkerSelected && !isOnWorkerRoute && (
            <div className="mt-2.5">
              <button
                onClick={() => handleNavigateToApp('worker')}
                className="w-full py-2 px-3 rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer"
              >
                <span>👉 শ্রমিক অ্যাপ ডাউনলোড করতে এই পেজে যান</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Device Platforms Tab: Android vs iPhone vs PC */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-2 pt-2">
          <button
            onClick={() => setActiveTab('android')}
            className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-t-xl flex items-center justify-center gap-1.5 transition ${
              activeTab === 'android'
                ? isWorkerSelected
                  ? 'bg-white text-teal-800 border-t-2 border-teal-600 shadow-xs'
                  : 'bg-white text-blue-700 border-t-2 border-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>অ্যান্ড্রয়েড (Android)</span>
          </button>
          <button
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-t-xl flex items-center justify-center gap-1.5 transition ${
              activeTab === 'ios'
                ? isWorkerSelected
                  ? 'bg-white text-teal-800 border-t-2 border-teal-600 shadow-xs'
                  : 'bg-white text-blue-700 border-t-2 border-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4 text-slate-800" />
            <span>আইফোন (iOS)</span>
          </button>
          <button
            onClick={() => setActiveTab('computer')}
            className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-t-xl flex items-center justify-center gap-1.5 transition ${
              activeTab === 'computer'
                ? isWorkerSelected
                  ? 'bg-white text-teal-800 border-t-2 border-teal-600 shadow-xs'
                  : 'bg-white text-blue-700 border-t-2 border-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Laptop className="w-4 h-4 text-teal-700" />
            <span>কম্পিউটার (PC)</span>
          </button>
        </div>

        {/* Step-by-Step Instructions Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          {/* App Icon Home Screen Preview */}
          <div className="p-3.5 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 rounded-2xl border border-teal-800/40 text-white flex items-center gap-3.5 shadow-sm">
            <div className="relative shrink-0">
              <div className="w-14 h-14 rounded-2xl bg-white p-1 border-2 border-amber-400 shadow-md flex items-center justify-center overflow-hidden">
                <img src="/logo.png" alt="টেক্স ওয়ার কারখানার লোগো" className="w-full h-full object-contain rounded-xl" />
              </div>
              <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-[9px] font-black px-1.5 py-0.2 rounded-full border border-white">
                {targetShortName}
              </span>
            </div>
            <div className="text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>মোবাইল স্ক্রিনে কারখানার গোল লোগো থাকবে</span>
              </div>
              <p className="text-[11px] text-slate-200 mt-0.5 leading-relaxed">
                ইনস্টল করার পর আপনার মোবাইলের হোম স্ক্রিনে <b>{targetShortName}</b> নামে কারখানার এই গোল লোগো বিশিষ্ট অ্যাপ পাবেন। কোনো ব্লু কালার বা ডিফল্ট আইকন আসবে না।
              </p>
            </div>
          </div>

          {/* Explanation Card */}
          {mode === 'admin' ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-xs text-amber-900">
                <Layers className="w-3.5 h-3.5 text-amber-700" />
                <span>একই মোবাইলে উভয় অ্যাপ ডাউনলোড করার নিয়ম:</span>
              </div>
              <p className="text-[11px] text-amber-900/90 leading-relaxed">
                উভয় অ্যাপের আইডি (App ID) ও স্কোপ সম্পূর্ণ স্বতন্ত্র ও আলাদা। তাই আপনার মোবাইলের হোম স্ক্রিনে <b>&quot;শ্রমিক অ্যাপ&quot;</b> এবং <b>&quot;টেক্স ওয়ার (Admin)&quot;</b> দুটিই পাশাপাশি স্বতন্ত্রভাবে ইনস্টল থাকবে। একটি অন্যটিকে মুছে ফেলবে না বা ওভাররাইট করবে না।
              </p>
            </div>
          ) : (
            <div className="p-3 bg-teal-50 border border-teal-200 rounded-2xl text-teal-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-xs text-teal-900">
                <Smartphone className="w-3.5 h-3.5 text-teal-700" />
                <span>শ্রমিক অ্যাপ ইনস্টলেশন নির্দেশনা:</span>
              </div>
              <p className="text-[11px] text-teal-900/90 leading-relaxed">
                অ্যাপটি মোবাইলে ইনস্টল করে নিলে কারখানার গোল লোগোতে স্পর্শ করেই এক ক্লিকে সরাসরি আপনার প্রোফাইল, হাজিরা ও বেতন বিবরণী দেখতে পারবেন। বারবার ব্রাউজারে লিংক খুঁজতে হবে না।
              </p>
            </div>
          )}

          {activeTab === 'android' && (
            <div className={`space-y-3 transition-all ${guideHighlighted ? 'ring-2 ring-emerald-500 rounded-2xl p-2 bg-emerald-50/30' : ''}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-700 font-bold flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>গুগল ক্রোম (Google Chrome) দিয়ে ৩ ধাপে ইনস্টল করার নিয়ম:</span>
                </p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  সহজ ৩ ধাপ
                </span>
              </div>

              <div className="space-y-2.5">
                <div className="flex gap-3 items-start p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="w-6 h-6 rounded-full bg-teal-700 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                    ১
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1">
                      <span>ক্রোম ব্রাউজারের ৩ ডটে</span>
                      <MoreVertical className="w-4 h-4 text-teal-700 inline" />
                      <span>চাপ দিন</span>
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      মোবাইলে গুগল ক্রোম ব্রাউজারের উপরে ডান পাশের কোনায় ৩টি ডট <MoreVertical className="w-3.5 h-3.5 inline text-slate-700" /> মেনু বাটনে স্পর্শ করুন।
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="w-6 h-6 rounded-full bg-teal-700 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                    ২
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">
                      &quot;Install app&quot; বা &quot;Add to Home screen&quot; নির্বাচন করুন
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      মেনু থেকে <b>&quot;Install app&quot;</b> (বা বাংলায় <b>&quot;হোম স্ক্রিনে যোগ করুন&quot;</b> / <b>&quot;Install and create shortcut&quot;</b>) অপশনটিতে চাপ দিন।
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start p-3 bg-emerald-50 border border-emerald-300 rounded-2xl">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                    ৩
                  </div>
                  <div className="w-full">
                    <h4 className="font-bold text-emerald-950 text-xs">
                      &quot;Install&quot; (ইনস্টল) বা &quot;Create shortcut&quot; এ চাপ দিন
                    </h4>
                    <p className="text-[11px] text-emerald-900 mt-1 leading-relaxed">
                      স্ক্রিনে আসা মেনু থেকে সরাসরি <b>&quot;Install&quot; (বা বাংলায় &quot;ইনস্টল&quot;)</b> বাটনে স্পর্শ করুন। সাথে সাথে আপনার ফোনের অ্যাপ ড্রয়ার ও হোম স্ক্রিনে কারখানার গোল লোগো সহ অ্যাপটি ইনস্টল হয়ে যাবে।
                    </p>

                    <div className="mt-2.5 p-2.5 bg-emerald-100/70 border border-emerald-300 rounded-xl text-[11px] text-emerald-950 space-y-1">
                      <div className="font-black text-emerald-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>💡 সহজ উপায়:</span>
                      </div>
                      <p className="text-[10.5px] leading-relaxed text-emerald-950">
                        মেনুতে <b>&quot;Install&quot;</b> দেখালে তাতে চাপ দিয়ে সরাসরি ইনস্টল করুন। অথবা কোনো কোনো ফোনে <b>&quot;Create shortcut&quot;</b> অপশন সক্রিয় থাকলে সেটিতে চাপ দিলেও সাধারণ মোবাইল অ্যাপের মতো ফুল-স্ক্রিন মোডে হোম স্ক্রিনে <b>&quot;{targetShortName}&quot;</b> পেয়ে যাবেন।
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ios' && (
            <div className={`space-y-3 transition-all ${guideHighlighted ? 'ring-2 ring-emerald-500 rounded-2xl p-2 bg-emerald-50/30' : ''}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-700 font-bold flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-slate-800" />
                  <span>আইফোনে অ্যাপল সাফারি (Safari) দিয়ে ৪ ধাপে ইনস্টল:</span>
                </p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                  Safari গাইড
                </span>
              </div>

              <div className="space-y-2.5">
                <div className="flex gap-3 items-start p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                    ১
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">সাফারি ব্রাউজারে লিংকটি খুলুন</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      আইফোনের ডিফল্ট <b>Safari</b> ব্রাউজারে এই ওয়েব পেজটি ওপেন করুন।
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                    ২
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">শেয়ার (Share) আইকনে চাপ দিন</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      সাফারির নিচে মাঝখানে থাকা শেয়ার আইকন <Share2 className="w-3.5 h-3.5 inline text-teal-700" /> (বা তীরের চিহ্ন) এ স্পর্শ করুন।
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                    ৩
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">
                      &quot;Add to Home Screen&quot; নির্বাচন করুন
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      মেনু একটু নিচে স্ক্রল করে <PlusSquare className="w-3.5 h-3.5 inline text-slate-700" /> <b>&quot;Add to Home Screen&quot;</b> (হোম স্ক্রিনে যোগ করুন) চাপুন।
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start p-3 bg-emerald-50 border border-emerald-300 rounded-2xl">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                    ৪
                  </div>
                  <div>
                    <h4 className="font-bold text-emerald-950 text-xs">
                      উপরে ডান পাশের &quot;Add&quot; বাটনে চাপুন
                    </h4>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      ডান পাশের উপরে <b>&quot;Add&quot;</b> এ চাপলেই কারখানার গোল লোগো সংবলিত <b>&quot;{targetShortName}&quot;</b> অ্যাপটি আপনার স্ক্রিনে আলাদাভাবে যুক্ত হয়ে যাবে।
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'computer' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 font-medium">
                কম্পিউটারে গুগল ক্রোম বা মাইক্রোসফট এজ (Edge) দিয়ে সরাসরি ডেস্কটপ অ্যাপ হিসেবে ইনস্টল করা যায়:
              </p>

              <div className="space-y-2.5">
                <div className="flex gap-3 items-start p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="w-6 h-6 rounded-full bg-teal-700 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                    ১
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">ব্রাউজারের অ্যাড্রেস বার লক্ষ্য করুন</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      ব্রাউজারের URL অ্যাড্রেস বারের ডান পাশে একটি ছোট <Download className="w-3.5 h-3.5 inline text-teal-700" /> (Install App) আইকন দেখতে পাবেন।
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                    ২
                  </div>
                  <div>
                    <h4 className="font-bold text-emerald-950 text-xs">&quot;Install&quot; এ ক্লিক করুন</h4>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      ক্লিক করে &quot;Install&quot; নির্বাচন করলেই আপনার কম্পিউটারের ডেস্কটপ ও স্টার্ট মেনুতে আলাদা স্বতন্ত্র অ্যাপ হিসেবে খুলে যাবে।
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Features note */}
          <div className="p-3 rounded-2xl space-y-1.5 bg-slate-50 border border-slate-200 text-slate-800">
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>ফোনে অ্যাপ ইনস্টল রাখার সুবিধা:</span>
            </div>
            <ul className="text-[11px] list-disc list-inside space-y-0.5 text-slate-600">
              <li>প্লে-স্টোরের কোনো ঝামেলা ছাড়াই সরাসরি গুগল ক্রোম প্রযুক্তির আসল অ্যাপ।</li>
              <li>হোম স্ক্রিনে সরাসরি কারখানার গোল লোগো থাকবে (কোনো ব্লু কালার বা ডিফল্ট আইকন নয়)।</li>
              <li>ব্রাউজারের অ্যাড্রেস বার ছাড়া ফুল-স্ক্রিন অ্যাপ মোডে চলবে।</li>
              <li>এক ক্লিকেই যেকোনো সময় নিজের হাজিরা, ওটি ও বেতন বিবরণী দেখা যাবে।</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500">
            {mode === 'worker' ? 'শ্রমিক পোর্টাল • টেক্স ওয়ার অ্যাপারেলস' : (isWorkerSelected ? 'আইডি: /texwareworker' : 'আইডি: /?app=admin')}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer"
          >
            বুঝেছি, বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
