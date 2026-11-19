import React, { useState, useEffect } from 'react';
import {
  Menu,
  Calculator,
  LayoutDashboard,
  Lock,
  Smartphone,
  ExternalLink,
  Users,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { isTelegramWebApp, openInExternalBrowser } from '../lib/telegram';
import { toBengaliNumber } from '../lib/utils';

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

interface HeaderProps {
  currentTab: AppMode;
  onTabChange: (tab: AppMode) => void;
  activeCount: number;
  resignedCount: number;
  suspendedCount?: number;
  terminatedCount?: number;
  totalCount: number;
  pendingApplicationsCount?: number;
  onOpenInstallModal?: () => void;
  onOpenMobileMenu?: () => void;
  onBack?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  activeCount,
  resignedCount,
  suspendedCount = 0,
  terminatedCount = 0,
  totalCount,
  pendingApplicationsCount = 0,
  onOpenInstallModal,
  onOpenMobileMenu,
  onBack,
}) => {
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    setIsTelegram(isTelegramWebApp());
  }, []);

  const meta = VIEW_TITLES[currentTab] || VIEW_TITLES.dashboard;
  const isAdminSessionActive =
    typeof window !== 'undefined' && sessionStorage.getItem('texware_admin_session') === 'true';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 no-print">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-5 lg:px-6 h-14 flex items-center justify-between gap-4">
        {/* Left Zone: Mobile Sidebar Trigger + Back Button + Contextual Breadcrumb */}
        <div className="flex items-center gap-2.5 min-w-0">
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              aria-label="মেনু খুলুন"
              className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span>ফিরে যান</span>
            </button>
          )}

          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => onTabChange('dashboard')}
              className="lg:hidden flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <img src="/logo.png" alt="Logo" className="w-7 h-7 rounded-lg object-contain border border-slate-200" />
            </button>
            <div className="min-w-0 flex items-center gap-2 text-xs">
              <span className="hidden sm:inline font-medium text-slate-500 whitespace-nowrap">
                {meta.section}
              </span>
              <span className="hidden sm:inline text-slate-300" aria-hidden="true">/</span>
              <span className="text-slate-900 font-bold text-sm tracking-tight truncate">
                {meta.title}
              </span>
            </div>
          </div>
        </div>

        {/* Center Zone: Unboxed Inline Workforce Metrics */}
        <div className="hidden md:flex items-center gap-3 text-xs text-slate-600 font-medium tabular-nums shrink-0">
          <button
            type="button"
            onClick={() => onTabChange('admin')}
            className="flex items-center gap-1.5 hover:text-slate-950 transition-colors cursor-pointer whitespace-nowrap"
            title="কর্মী তালিকা দেখুন"
          >
            <Users className="w-3.5 h-3.5 text-teal-700" />
            <span>সক্রিয় <b className="font-mono text-slate-900">{toBengaliNumber(activeCount)}</b></span>
          </button>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span className="whitespace-nowrap">
            রিজাইন <b className="font-mono text-slate-800">{toBengaliNumber(resignedCount)}</b>
          </span>
          {(suspendedCount > 0 || terminatedCount > 0) && (
            <>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="whitespace-nowrap">
                স্থগিত/অব্যাহতি <b className="font-mono text-slate-800">{toBengaliNumber(suspendedCount + terminatedCount)}</b>
              </span>
            </>
          )}
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span className="whitespace-nowrap">
            মোট <b className="font-mono text-slate-900">{toBengaliNumber(totalCount)}</b>
          </span>
          {pendingApplicationsCount > 0 && (
            <>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => onTabChange('applications')}
                className="text-amber-700 hover:text-amber-900 font-semibold cursor-pointer whitespace-nowrap"
              >
                আবেদন <span className="font-mono font-bold">{toBengaliNumber(pendingApplicationsCount)}</span>
              </button>
            </>
          )}
        </div>

        {/* Right Zone: Clean Single-Line Action Bar */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenInstallModal && (
            <button
              type="button"
              id="btnInstallAppHeader"
              onClick={onOpenInstallModal}
              title="অ্যাপ ডাউনলোড ও ইনস্টল নির্দেশিকা"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Smartphone className="w-3.5 h-3.5 text-teal-700 shrink-0" />
              <span className="hidden xl:inline">অ্যাপ ইনস্টল</span>
            </button>
          )}

          {currentTab !== 'dashboard' && (
            <button
              type="button"
              onClick={() => onTabChange('dashboard')}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>ড্যাশবোর্ড</span>
            </button>
          )}

          {currentTab !== 'user' && (
            <button
              type="button"
              id="btnUserAccess"
              onClick={() => onTabChange('user')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              currentTab === 'admin'
                ? 'bg-slate-900 text-teal-300 border border-slate-900'
                : 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-900'
            }`}
          >
            {isAdminSessionActive ? (
              <ShieldCheck className="w-3.5 h-3.5 text-teal-300 shrink-0" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-teal-300 shrink-0" />
            )}
            <span>{isAdminSessionActive ? 'অ্যাডমিন প্যানেল' : 'অ্যাডমিন লগইন'}</span>
          </button>
        </div>
      </div>

      {/* Telegram WebApp External Browser Notice */}
      {isTelegram && (
        <div className="bg-slate-900 text-white border-t border-slate-800 px-3 sm:px-6 py-2">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-3 text-xs">
            <span className="truncate">
              <b className="text-teal-300">Telegram মোড:</b> সরাসরি প্রিন্ট ও ডাউনলোড করতে বাহ্যিক ব্রাউজারে খুলুন
            </span>
            <button
              type="button"
              onClick={() => openInExternalBrowser()}
              className="px-2.5 py-1 rounded-md bg-teal-700 hover:bg-teal-600 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
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
