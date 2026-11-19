import React from 'react';
import {
  LayoutDashboard,
  Calculator,
  Users,
  Clock,
  Receipt,
  FileText,
  TrendingUp,
  Briefcase,
  UserCheck,
  FilePlus2,
  Smartphone,
  UserPlus,
  IdCard,
  Send,
  MessageSquare,
  Building2,
  KeyRound,
  ShieldCheck,
  X,
  ChevronRight,
} from 'lucide-react';
import { AppMode } from './Header';
import { toBengaliNumber } from '../lib/utils';

interface SidebarProps {
  currentTab: AppMode;
  onTabChange: (tab: AppMode) => void;
  pendingApplicationsCount: number;
  activeWorkersCount: number;
  onOpenInstallModal: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id?: string;
  tab?: AppMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  onClick?: () => void;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  pendingApplicationsCount,
  activeWorkersCount,
  onOpenInstallModal,
  mobileOpen,
  onCloseMobile,
}) => {
  const isAdminSessionActive =
    typeof window !== 'undefined' && sessionStorage.getItem('texware_admin_session') === 'true';

  const groups: NavGroup[] = [
    {
      heading: 'মূল কর্মক্ষেত্র',
      items: [
        { tab: 'dashboard', label: 'সমন্বিত ড্যাশবোর্ড', icon: LayoutDashboard },
        { tab: 'user', label: 'বেতন ক্যালকুলেটর', icon: Calculator },
        { tab: 'admin', label: 'কর্মী তালিকা ও স্ট্যাটাস', icon: Users, badge: activeWorkersCount },
        { tab: 'attendance', label: 'দৈনিক হাজিরা ও টাইম', icon: Clock },
        { tab: 'salaries', label: 'মাসিক বেতন খাতা', icon: Receipt },
        {
          tab: 'applications',
          label: 'আবেদন ব্যবস্থাপনা',
          icon: FileText,
          badge: pendingApplicationsCount > 0 ? pendingApplicationsCount : undefined,
        },
      ],
    },
    {
      heading: 'আর্থিক ও পোর্টাল',
      items: [
        { id: 'btnInvestmentPortal', tab: 'investment', label: 'ইনভেস্টমেন্ট হাব', icon: TrendingUp },
        { tab: 'investor', label: 'ইনভেস্টর পোর্টাল', icon: Briefcase },
        { id: 'btnWorkerPortalAccess', tab: 'worker', label: 'শ্রমিক পোর্টাল', icon: UserCheck },
        { id: 'btnJobApplicationPortal', tab: 'apply', label: 'অনলাইন নিয়োগ ফরম', icon: FilePlus2 },
        { label: 'অ্যাপ ইনস্টল (PWA)', icon: Smartphone, onClick: onOpenInstallModal },
      ],
    },
    {
      heading: 'সেটিংস ও অটোমেশন',
      items: [
        { tab: 'form', label: 'নতুন কর্মী নিবন্ধন', icon: UserPlus },
        { tab: 'details', label: 'প্রোফাইল ও প্রিন্ট', icon: IdCard },
        { tab: 'telegram', label: 'Telegram Bot', icon: Send },
        { tab: 'sms', label: 'Auto SMS গেটওয়ে', icon: MessageSquare },
        { tab: 'factory', label: 'কারখানা ও চুক্তি তথ্য', icon: Building2 },
        { tab: 'password', label: 'পাসওয়ার্ড ও নিরাপত্তা', icon: KeyRound },
      ],
    },
  ];

  const handleSelect = (item: NavItem) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.tab) {
      onTabChange(item.tab);
    }
    onCloseMobile();
  };

  const renderNavContent = () => (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300 select-none">
      {/* Brand Header */}
      <div className="h-14 px-4 border-b border-slate-800/80 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={() => {
            onTabChange('dashboard');
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-white p-0.5 flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-white/15">
            <img src="/logo.png" alt="টেক্স ওয়ার অ্যাপারেলস" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-white tracking-tight truncate group-hover:text-teal-300 transition-colors">
              টেক্স ওয়ার অ্যাপারেলস
            </div>
            <div className="text-[10px] font-medium text-slate-400 tracking-wide truncate">
              Enterprise HR &amp; Payroll
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="সাইডবার বন্ধ করুন"
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto enterprise-scroll px-2.5 py-3 space-y-4">
        {groups.map((group) => (
          <div key={group.heading}>
            <div className="px-2.5 mb-1.5 text-[10.5px] font-semibold tracking-wide text-slate-500">
              {group.heading}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = Boolean(item.tab && currentTab === item.tab);
                return (
                  <button
                    key={item.label}
                    type="button"
                    id={item.id}
                    onClick={() => handleSelect(item)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors duration-150 cursor-pointer text-left ${
                      isActive
                        ? 'bg-teal-500/15 text-white border border-teal-500/30 font-semibold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-900 border border-transparent'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                          isActive ? 'text-teal-400' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate whitespace-nowrap">{item.label}</span>
                    </span>

                    {typeof item.badge === 'number' && (
                      <span
                        className={`text-[10.5px] font-mono font-semibold tabular-nums shrink-0 ${
                          item.tab === 'applications' && item.badge > 0
                            ? 'text-amber-400'
                            : isActive
                            ? 'text-teal-300'
                            : 'text-slate-500'
                        }`}
                      >
                        {toBengaliNumber(item.badge)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Compact Admin Access Footer */}
      <div className="p-3 border-t border-slate-800/80 shrink-0">
        <button
          type="button"
          onClick={() => {
            onTabChange('admin');
            onCloseMobile();
          }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors duration-150 cursor-pointer ${
            isAdminSessionActive
              ? 'bg-slate-900 hover:bg-slate-800 text-teal-300 border border-slate-700/80'
              : 'bg-teal-700 hover:bg-teal-600 text-white border border-teal-600'
          }`}
        >
          <span className="flex items-center gap-2 whitespace-nowrap">
            <ShieldCheck className={`w-4 h-4 shrink-0 ${isAdminSessionActive ? 'text-teal-400' : 'text-teal-100'}`} />
            <span>{isAdminSessionActive ? 'অ্যাডমিন প্যানেল সক্রিয়' : 'অ্যাডমিন লগইন'}</span>
          </span>
          <ChevronRight className="w-3.5 h-3.5 opacity-75 shrink-0" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-62 shrink-0 flex-col bg-slate-950 border-r border-slate-800 sticky top-0 h-screen no-print">
        {renderNavContent()}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <aside className="relative w-68 max-w-[85vw] bg-slate-950 h-full border-r border-slate-800 shadow-2xl z-10 flex flex-col">
            {renderNavContent()}
          </aside>
        </div>
      )}
    </>
  );
};
