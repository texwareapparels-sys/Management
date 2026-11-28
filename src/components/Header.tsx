import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Menu,
  Calculator,
  LayoutDashboard,
  Lock,
  Smartphone,
  ExternalLink,
  ArrowLeft,
  ShieldCheck,
  Search,
  Bell,
  Settings,
  Maximize2,
  Minimize2,
  Calendar,
  User,
} from 'lucide-react';
import { Employee } from '../types';
import { isTelegramWebApp, openInExternalBrowser } from '../lib/telegram';
import { formatDateBn, toBengaliNumber } from '../lib/utils';

export type AppMode =
  | 'dashboard'
  | 'user'
  | 'admin'
  | 'attendance'
  | 'salaries'
  | 'form'
  | 'details'
  | 'password'
  | 'telegram'
  | 'sms'
  | 'factory'
  | 'apply'
  | 'applications'
  | 'worker'
  | 'investment'
  | 'investor';

const VIEW_TITLES: Record<AppMode, { title: string; section: string }> = {
  dashboard: { title: 'সমন্বিত ড্যাশবোর্ড', section: 'প্রধান কমান্ড হাব' },
  user: { title: 'বেতন ক্যালকুলেটর ও পে-স্লিপ', section: 'পে-রোল' },
  admin: { title: 'কর্মী তালিকা ও স্ট্যাটাস', section: 'অ্যাডমিন প্যানেল' },
  attendance: { title: 'দৈনিক হাজিরা ও ইন-আউট', section: 'অ্যাডমিন প্যানেল' },
  salaries: { title: 'মাসিক বেতন খাতা', section: 'অ্যাডমিন প্যানেল' },
  form: { title: 'নতুন কর্মী নিবন্ধন', section: 'অ্যাডমিন প্যানেল' },
  details: { title: 'কর্মী প্রোফাইল ও প্রিন্ট', section: 'অ্যাডমিন প্যানেল' },
  applications: { title: 'চাকরির আবেদন ব্যবস্থাপনা', section: 'নিয়োগ' },
  investment: { title: 'ইনভেস্টমেন্ট ও তহবিল হাব', section: 'ফাইন্যান্স' },
  investor: { title: 'ইনভেস্টর পোর্টাল', section: 'ফাইন্যান্স' },
  worker: { title: 'শ্রমিক ব্যক্তিগত পোর্টাল', section: 'পোর্টাল' },
  apply: { title: 'অনলাইন নিয়োগ ফরম', section: 'নিয়োগ' },
  telegram: { title: 'Telegram Bot সেটিংস', section: 'সিস্টেম ও অটোমেশন' },
  sms: { title: 'Auto SMS গেটওয়ে', section: 'সিস্টেম ও অটোমেশন' },
  factory: { title: 'কারখানা তথ্য ও চুক্তি', section: 'সিস্টেম ও অটোমেশন' },
  password: { title: 'অ্যাডমিন পাসওয়ার্ড ও নিরাপত্তা', section: 'সিস্টেম ও অটোমেশন' },
};

const QUICK_MODULE_SEARCH_LIST: { tab: AppMode; label: string; keywords: string }[] = [
  { tab: 'dashboard', label: 'সমন্বিত ড্যাশবোর্ড', keywords: 'dashboard home ড্যাশবোর্ড' },
  { tab: 'user', label: 'বেতন ক্যালকুলেটর', keywords: 'salary calculator বেতন ক্যালকুলেটর পে-স্লিপ' },
  { tab: 'admin', label: 'কর্মী তালিকা ও অ্যাডমিন', keywords: 'workers admin list কর্মী তালিকা অ্যাডমিন' },
  { tab: 'attendance', label: 'দৈনিক হাজিরা', keywords: 'attendance in out হাজিরা ইন আউট ওভারটাইম' },
  { tab: 'salaries', label: 'মাসিক বেতন খাতা', keywords: 'payroll sheet বেতন খাতা মাসিক' },
  { tab: 'applications', label: 'আবেদন ব্যবস্থাপনা', keywords: 'job applications আবেদন নিয়োগ' },
  { tab: 'form', label: 'নতুন কর্মী যোগ', keywords: 'add worker নতুন কর্মী নিবন্ধন' },
  { tab: 'details', label: 'প্রোফাইল ও আইডি প্রিন্ট', keywords: 'profile id card প্রোফাইল চুক্তি' },
  { tab: 'investment', label: 'ইনভেস্টমেন্ট হাব', keywords: 'investment capital ইনভেস্টমেন্ট বিনিয়োগ' },
  { tab: 'investor', label: 'ইনভেস্টর পোর্টাল', keywords: 'investor portal ইনভেস্টর পোর্টাল' },
  { tab: 'worker', label: 'শ্রমিক পোর্টাল', keywords: 'worker portal শ্রমিক পোর্টাল' },
  { tab: 'apply', label: 'অনলাইন নিয়োগ ফরম', keywords: 'apply form অনলাইন ফরম' },
  { tab: 'telegram', label: 'Telegram Bot সেটিংস', keywords: 'telegram bot টেলিগ্রাম বট' },
  { tab: 'sms', label: 'Auto SMS গেটওয়ে', keywords: 'sms gateway অটো এসএমএস' },
  { tab: 'factory', label: 'কারখানা তথ্য ও সেটিংস', keywords: 'factory settings কারখানা সেটিংস' },
  { tab: 'password', label: 'পাসওয়ার্ড ও নিরাপত্তা', keywords: 'password security পাসওয়ার্ড নিরাপত্তা' },
];

interface HeaderProps {
  currentTab: AppMode;
  onTabChange: (tab: AppMode) => void;
  activeCount: number;
  resignedCount: number;
  suspendedCount?: number;
  terminatedCount?: number;
  totalCount: number;
  pendingApplicationsCount?: number;
  employees?: Employee[];
  onOpenInstallModal?: () => void;
  onOpenMobileMenu?: () => void;
  onBack?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  pendingApplicationsCount = 0,
  employees = [],
  onOpenInstallModal,
  onOpenMobileMenu,
  onBack,
}) => {
  const [isTelegram, setIsTelegram] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsTelegram(isTelegramWebApp());
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const meta = VIEW_TITLES[currentTab] || VIEW_TITLES.dashboard;
  const isAdminSessionActive =
    typeof window !== 'undefined' && sessionStorage.getItem('texware_admin_session') === 'true';

  const todayIso = new Date().toISOString().split('T')[0];

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { modules: [], workers: [] };
    const modules = QUICK_MODULE_SEARCH_LIST.filter(
      (m) => m.label.toLowerCase().includes(q) || m.keywords.toLowerCase().includes(q)
    ).slice(0, 5);
    const workers = employees
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.workerId.toLowerCase().includes(q) ||
          (e.designation && e.designation.toLowerCase().includes(q)) ||
          (e.mobile && e.mobile.toLowerCase().includes(q))
      )
      .slice(0, 5);
    return { modules, workers };
  }, [searchQuery, employees]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen may be restricted in nested iframes
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-[#08142E] text-white border-b border-[#162752] no-print">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-5 h-14 flex items-center justify-between gap-3">
        {/* Left Zone: Mobile Menu + Back Button + Breadcrumb */}
        <div className="flex items-center gap-2.5 min-w-0 shrink-0 lg:shrink">
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              aria-label="মেনু খুলুন"
              className="lg:hidden p-2 -ml-1 rounded-lg text-slate-300 hover:text-white hover:bg-[#132550] transition-colors cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {onBack && currentTab !== 'dashboard' && (
            <button
              type="button"
              id="btnHeaderBack"
              onClick={onBack}
              title="আগের পেজে ফিরে যান"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#10204A] hover:bg-[#19306B] text-white border border-[#243E80] text-xs font-semibold transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>ফিরে যান</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onTabChange('dashboard')}
            className="lg:hidden flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <img src="/logo.png" alt="Logo" className="w-7 h-7 rounded-lg object-contain bg-white p-0.5" />
          </button>

          <div className="hidden sm:flex items-center gap-2 min-w-0 text-xs">
            <span className="text-slate-400 font-medium whitespace-nowrap hidden xl:inline">
              {meta.section}
            </span>
            <span className="text-slate-600 hidden xl:inline" aria-hidden="true">/</span>
            <span className="text-white font-bold text-sm tracking-tight truncate max-w-[200px]">
              {meta.title}
            </span>
          </div>
        </div>

        {/* Center Zone: Live Global Search Bar (matching reference white rounded search pill) */}
        <div ref={searchRef} className="relative flex-1 max-w-md hidden md:block">
          <div className="flex items-center bg-white rounded-full px-3.5 py-1.5 shadow-inner border border-slate-200/80">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              placeholder="কর্মী, আইডি বা মডিউল খুঁজুন..."
              className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 px-2.5 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[11px] text-slate-400 hover:text-slate-700 px-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {isSearchOpen && searchQuery.trim() && (
            <div className="absolute left-0 right-0 mt-1.5 bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50">
              {searchResults.modules.length === 0 && searchResults.workers.length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-500 text-center">
                  কোনো মডিউল বা কর্মী পাওয়া যায়নি
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {searchResults.modules.map((mod) => (
                    <button
                      key={mod.tab}
                      type="button"
                      onClick={() => {
                        onTabChange(mod.tab);
                        setSearchQuery('');
                        setIsSearchOpen(false);
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-blue-50 flex items-center justify-between text-xs cursor-pointer transition-colors"
                    >
                      <span className="font-semibold text-slate-800">{mod.label}</span>
                      <span className="text-[11px] font-semibold text-blue-600">খুলুন →</span>
                    </button>
                  ))}
                  {searchResults.workers.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => {
                        onTabChange('details');
                        setSearchQuery('');
                        setIsSearchOpen(false);
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center justify-between text-xs cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-900 truncate">{emp.name}</span>
                        <span className="text-[11px] text-slate-500 truncate">({emp.designation})</span>
                      </span>
                      <span className="font-mono text-[11px] font-bold text-slate-600 tabular-nums shrink-0">
                        {emp.workerId}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Zone: Date + Bell + Settings + Fullscreen + Quick Actions + Admin Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10204A] border border-[#1E356B] text-[11.5px] text-slate-200 font-medium whitespace-nowrap">
            <Calendar className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="tabular-nums">{formatDateBn(todayIso)}</span>
          </div>

          <button
            type="button"
            onClick={() => onTabChange('applications')}
            title="পেন্ডিং চাকরির আবেদনসমূহ"
            className="relative p-2 rounded-lg bg-[#10204A] hover:bg-[#19306B] text-slate-200 hover:text-white border border-[#1E356B] transition-colors cursor-pointer shrink-0"
          >
            <Bell className="w-4 h-4" />
            {pendingApplicationsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold flex items-center justify-center tabular-nums">
                {toBengaliNumber(pendingApplicationsCount)}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onTabChange('factory')}
            title="কারখানা সেটিংস"
            className="hidden sm:flex p-2 rounded-lg bg-[#10204A] hover:bg-[#19306B] text-slate-200 hover:text-white border border-[#1E356B] transition-colors cursor-pointer shrink-0"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            title="ফুলস্ক্রিন মোড"
            className="hidden lg:flex p-2 rounded-lg bg-[#10204A] hover:bg-[#19306B] text-slate-200 hover:text-white border border-[#1E356B] transition-colors cursor-pointer shrink-0"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {onOpenInstallModal && (
            <button
              type="button"
              id="btnInstallAppHeader"
              onClick={onOpenInstallModal}
              title="অ্যাপ ডাউনলোড ও ইনস্টল নির্দেশিকা"
              className="hidden sm:flex items-center gap-1.5 p-2 xl:px-2.5 xl:py-1.5 rounded-lg bg-[#10204A] hover:bg-[#19306B] text-slate-200 hover:text-white border border-[#1E356B] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Smartphone className="w-4 h-4 text-sky-300 shrink-0" />
              <span className="hidden 2xl:inline">অ্যাপ ইনস্টল</span>
            </button>
          )}

          {currentTab !== 'dashboard' && (
            <button
              type="button"
              onClick={() => onTabChange('dashboard')}
              title="মূল ড্যাশবোর্ড"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#10204A] hover:bg-[#19306B] text-slate-200 hover:text-white border border-[#1E356B] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-sky-300 shrink-0" />
              <span className="hidden xl:inline">ড্যাশবোর্ড</span>
            </button>
          )}

          {currentTab !== 'user' && (
            <button
              type="button"
              id="btnUserAccess"
              onClick={() => onTabChange('user')}
              title="বেতন ক্যালকুলেটর"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Calculator className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">বেতন ক্যালকুলেটর</span>
            </button>
          )}

          <button
            type="button"
            id="btnAdminAccess"
            onClick={() => onTabChange('admin')}
            title="অ্যাডমিন লগইন / কন্ট্রোল প্যানেল"
            className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              currentTab === 'admin'
                ? 'bg-gradient-to-r from-[#1D63DC] to-[#2563EB] text-white shadow-sm'
                : 'bg-[#132550] hover:bg-[#1C3570] text-white border border-[#27458D]'
            }`}
          >
            {isAdminSessionActive ? (
              <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            )}
            <span className="text-left leading-tight">
              {isAdminSessionActive ? 'অ্যাডমিন প্যানেল' : 'অ্যাডমিন লগইন'}
            </span>
          </button>
        </div>
      </div>

      {/* Telegram WebApp External Browser Notice */}
      {isTelegram && (
        <div className="bg-[#050C1D] text-white border-t border-[#162752] px-3 sm:px-6 py-2">
          <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-3 text-xs">
            <span className="truncate">
              <b className="text-amber-300">Telegram মোড:</b> সরাসরি প্রিন্ট ও ডাউনলোড করতে বাহ্যিক ব্রাউজারে খুলুন
            </span>
            <button
              type="button"
              onClick={() => openInExternalBrowser()}
              className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              <span>ব্রাউজারে খুলুন</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
