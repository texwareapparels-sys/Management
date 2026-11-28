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
  Activity,
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
        { tab: 'dashboard', label: 'ড্যাশবোর্ড', icon: LayoutDashboard },
        { tab: 'user', label: 'বেতন ক্যালকুলেটর', icon: Calculator },
        { tab: 'admin', label: 'কর্মী তালিকা', icon: Users, badge: activeWorkersCount },
        { tab: 'attendance', label: 'দৈনিক হাজিরা', icon: Clock },
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
        { tab: 'form', label: 'নতুন কর্মী যোগ', icon: UserPlus },
        { tab: 'details', label: 'প্রোফাইল ও প্রিন্ট', icon: IdCard },
        { tab: 'telegram', label: 'Telegram Bot', icon: Send },
        { tab: 'sms', label: 'Auto SMS', icon: MessageSquare },
        { tab: 'factory', label: 'কারখানা ও চুক্তি', icon: Building2 },
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
    <div className="flex flex-col h-full bg-[#08142E] text-slate-300 select-none">
      {/* Brand Header matching Navy ERP Frame */}
      <div className="h-14 px-4 border-b border-[#162752] flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={() => {
            onTabChange('dashboard');
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
            <img src="/logo.png" alt="টেক্স ওয়ার অ্যাপারেলস" className="w-full h-full object-contain rounded-md bg-white/95" />
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-bold text-white tracking-tight truncate group-hover:text-amber-300 transition-colors">
              টেক্স ওয়ার অ্যাপারেলস
            </div>
            <div className="text-[10px] font-medium text-slate-400 tracking-wide truncate">
              Smart Garments HR &amp; Payroll
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="সাইডবার বন্ধ করুন"
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#132550] cursor-pointer transition-colors"
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
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[12.5px] font-medium transition-all duration-150 cursor-pointer text-left ${
                      isActive
                        ? 'bg-gradient-to-r from-[#1D63DC] to-[#2563EB] text-white font-semibold shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-[#10204A]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-white' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate whitespace-nowrap">{item.label}</span>
                    </span>

                    <span className="flex items-center gap-1 shrink-0">
                      {typeof item.badge === 'number' && (
                        <span
                          className={`text-[10.5px] font-mono font-bold tabular-nums ${
                            item.tab === 'applications' && item.badge > 0
                              ? 'text-amber-300'
                              : isActive
                              ? 'text-blue-100'
                              : 'text-slate-400'
                          }`}
                        >
                          {toBengaliNumber(item.badge)}
                        </span>
                      )}
                      <ChevronRight
                        className={`w-3.5 h-3.5 ${
                          isActive ? 'text-white/90' : 'text-slate-600'
                        }`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Live Factory Card + Direct Admin Access */}
      <div className="p-3 border-t border-[#162752] space-y-2.5 shrink-0">
        <div className="rounded-xl bg-[#0D1E46] border border-[#1E356B] p-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-amber-400">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              <span>কারখানা সারসংক্ষেপ</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400">লাইভ</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-300 tabular-nums">
            <span>সক্রিয় কর্মী</span>
            <span className="font-mono font-bold text-white">{toBengaliNumber(activeWorkersCount)} জন</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-300 tabular-nums">
            <span>পেন্ডিং আবেদন</span>
            <span className={`font-mono font-bold ${pendingApplicationsCount > 0 ? 'text-amber-300' : 'text-emerald-400'}`}>
              {toBengaliNumber(pendingApplicationsCount)} টি
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onTabChange('admin');
            onCloseMobile();
          }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors duration-150 cursor-pointer ${
            isAdminSessionActive
              ? 'bg-[#10204A] hover:bg-[#162C63] text-sky-300 border border-[#233B78]'
              : 'bg-gradient-to-r from-[#1D63DC] to-[#2563EB] hover:from-[#1A58C7] hover:to-[#1D4ED8] text-white'
          }`}
        >
          <span className="flex items-center gap-2 whitespace-nowrap">
            <ShieldCheck className="w-4 h-4 shrink-0 text-amber-300" />
            <span>{isAdminSessionActive ? 'অ্যাডমিন প্যানেল সক্রিয়' : 'অ্যাডমিন লগইন'}</span>
          </span>
          <ChevronRight className="w-3.5 h-3.5 opacity-80 shrink-0" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-[#08142E] border-r border-[#162752] sticky top-0 h-screen no-print">
        {renderNavContent()}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <aside className="relative w-68 max-w-[85vw] bg-[#08142E] h-full border-r border-[#162752] shadow-2xl z-10 flex flex-col">
            {renderNavContent()}
          </aside>
        </div>
      )}
    </>
  );
};
