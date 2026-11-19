import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Calculator,
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
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Wallet,
} from 'lucide-react';
import {
  Employee,
  AttendanceRecord,
  SalaryDisbursementRecord,
  InvestmentRecord,
  JobApplication,
  FactorySettings,
} from '../types';
import {
  subscribeAttendanceRecords,
  subscribeSalaryRecords,
  subscribeInvestments,
  subscribeJobApplications,
  loadFactorySettings,
  DEFAULT_FACTORY_SETTINGS,
} from '../lib/firebase';
import { formatMoney, toBengaliNumber, formatDateBn } from '../lib/utils';
import { AppMode } from './Header';

const BENGALI_MONTHS = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

interface CommandDashboardProps {
  employees: Employee[];
  pendingApplicationsCount: number;
  onNavigate: (tab: AppMode) => void;
  onOpenInstallModal: () => void;
}

interface ModuleTile {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  featured?: boolean;
  tab?: AppMode;
  action?: () => void;
  statText?: string;
}

export const CommandDashboard: React.FC<CommandDashboardProps> = ({
  employees,
  pendingApplicationsCount,
  onNavigate,
  onOpenInstallModal,
}) => {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<SalaryDisbursementRecord[]>([]);
  const [investments, setInvestments] = useState<InvestmentRecord[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [factorySettings, setFactorySettings] = useState<FactorySettings>(DEFAULT_FACTORY_SETTINGS);

  useEffect(() => {
    const unsubAtt = subscribeAttendanceRecords(setAttendanceRecords);
    const unsubSal = subscribeSalaryRecords(setSalaryRecords);
    const unsubInv = subscribeInvestments(setInvestments);
    const unsubApp = subscribeJobApplications(setApplications);
    loadFactorySettings().then(setFactorySettings).catch(() => {});

    return () => {
      unsubAtt();
      unsubSal();
      unsubInv();
      unsubApp();
    };
  }, []);

  const isAdminSessionActive =
    typeof window !== 'undefined' && sessionStorage.getItem('texware_admin_session') === 'true';

  const now = new Date();
  const currentMonthName = BENGALI_MONTHS[now.getMonth()];
  const currentYear = now.getFullYear();
  const todayIso = now.toISOString().split('T')[0];

  const stats = useMemo(() => {
    const activeEmployees = employees.filter((e) => e.status === 'active');
    const resignedCount = employees.filter((e) => e.status === 'resigned').length;

    const currentMonthSalaries = salaryRecords.filter(
      (r) => r.month === currentMonthName && Number(r.year) === currentYear
    );
    const totalMonthNet = currentMonthSalaries.reduce((sum, r) => sum + Number(r.netPayable || 0), 0);
    const totalMonthPaid = currentMonthSalaries.reduce((sum, r) => sum + Number(r.paidAmount || 0), 0);
    const totalMonthDue = Math.max(0, totalMonthNet - totalMonthPaid);
    const paidRatio = totalMonthNet > 0 ? Math.min(100, Math.round((totalMonthPaid / totalMonthNet) * 100)) : 0;

    const todayAttendance = attendanceRecords.filter((a) => a.date === todayIso);
    const todayPresent = todayAttendance.filter(
      (a) => a.status === 'present' || a.status === 'late' || a.status === 'half_day'
    ).length;
    const attendanceRatio =
      activeEmployees.length > 0 ? Math.min(100, Math.round((todayPresent / activeEmployees.length) * 100)) : 0;

    const activeInvestments = investments.filter((i) => i.status === 'active');
    const totalActiveCapital = activeInvestments.reduce((sum, i) => sum + Number(i.amount || 0), 0);

    return {
      activeCount: activeEmployees.length,
      resignedCount,
      totalEmployees: employees.length,
      currentMonthSalaries,
      totalMonthNet,
      totalMonthPaid,
      totalMonthDue,
      paidRatio,
      todayPresent,
      todayTotalMarked: todayAttendance.length,
      attendanceRatio,
      activeInvestmentsCount: activeInvestments.length,
      totalActiveCapital,
    };
  }, [employees, salaryRecords, attendanceRecords, investments, currentMonthName, currentYear, todayIso]);

  const recentSalaries = useMemo(() => {
    const pool = stats.currentMonthSalaries.length > 0 ? stats.currentMonthSalaries : salaryRecords;
    return [...pool].sort((a, b) => (b.paidAt || 0) - (a.paidAt || 0)).slice(0, 3);
  }, [stats.currentMonthSalaries, salaryRecords]);

  const pendingApplications = useMemo(
    () => applications.filter((a) => a.status === 'pending').slice(0, 3),
    [applications]
  );

  const activeInvestmentsList = useMemo(
    () => investments.filter((i) => i.status === 'active').slice(0, 3),
    [investments]
  );

  // All 16 connected enterprise modules & settings unified in one disciplined zero-scroll grid
  const allModules: ModuleTile[] = [
    {
      title: isAdminSessionActive ? 'অ্যাডমিন ড্যাশবোর্ড' : 'অ্যাডমিন লগইন',
      subtitle: isAdminSessionActive ? 'কন্ট্রোল প্যানেল খুলুন' : 'পাসওয়ার্ড দিয়ে প্রবেশ',
      icon: ShieldCheck,
      featured: true,
      tab: 'admin',
      statText: isAdminSessionActive ? 'সেশন সক্রিয়' : 'প্রবেশ করুন',
    },
    {
      title: 'বেতন ক্যালকুলেটর',
      subtitle: 'হিসাব ও ৫৮মিমি স্লিপ',
      icon: Calculator,
      tab: 'user',
      statText: `${toBengaliNumber(stats.currentMonthSalaries.length)} প্রসেসড`,
    },
    {
      title: 'কর্মী তালিকা',
      subtitle: 'সক্রিয় ও রিজাইন স্ট্যাটাস',
      icon: Users,
      tab: 'admin',
      statText: `${toBengaliNumber(stats.activeCount)} জন সক্রিয়`,
    },
    {
      title: 'দৈনিক হাজিরা',
      subtitle: 'ইন-আউট ও ওটি ট্র্যাকিং',
      icon: Clock,
      tab: 'attendance',
      statText: `আজ ${toBengaliNumber(stats.todayPresent)} উপস্থিত`,
    },
    {
      title: 'বেতন খাতা',
      subtitle: 'পরিশোধ ও A4 শীট',
      icon: Receipt,
      tab: 'salaries',
      statText: `৳${formatMoney(stats.totalMonthNet)}`,
    },
    {
      title: 'আবেদন ব্যবস্থাপনা',
      subtitle: 'প্রার্থী যাচাই ও নিয়োগ',
      icon: FileText,
      tab: 'applications',
      statText: `${toBengaliNumber(pendingApplicationsCount)} পেন্ডিং`,
    },
    {
      title: 'নতুন কর্মী যোগ',
      subtitle: 'অটো TWA আইডি নিবন্ধন',
      icon: UserPlus,
      tab: 'form',
      statText: 'দ্রুত নিবন্ধন',
    },
    {
      title: 'প্রোফাইল ও প্রিন্ট',
      subtitle: 'আইডি কার্ড ও চুক্তিপত্র',
      icon: IdCard,
      tab: 'details',
      statText: `${toBengaliNumber(stats.totalEmployees)} প্রোফাইল`,
    },
    {
      title: 'ইনভেস্টমেন্ট হাব',
      subtitle: '৭–১২০ দিন ও A4 চুক্তি',
      icon: TrendingUp,
      tab: 'investment',
      statText: `৳${formatMoney(stats.totalActiveCapital)}`,
    },
    {
      title: 'ইনভেস্টর পোর্টাল',
      subtitle: '২৪ঘ. মুনাফা ক্লেম',
      icon: Briefcase,
      tab: 'investor',
      statText: `${toBengaliNumber(stats.activeInvestmentsCount)} চুক্তি`,
    },
    {
      title: 'শ্রমিক পোর্টাল',
      subtitle: 'শ্রমিকের নিজস্ব অ্যাপ',
      icon: UserCheck,
      tab: 'worker',
      statText: 'স্বতন্ত্র লিংক',
    },
    {
      title: 'অনলাইন নিয়োগ ফরম',
      subtitle: 'শেয়ারযোগ্য আবেদন লিংক',
      icon: FilePlus2,
      tab: 'apply',
      statText: 'পাবলিক ফরম',
    },
    {
      title: 'অ্যাপ ইনস্টল',
      subtitle: 'মোবাইল PWA ডাউনলোড',
      icon: Smartphone,
      action: onOpenInstallModal,
      statText: 'PWA রেডি',
    },
    {
      title: 'Telegram Bot',
      subtitle: 'তাৎক্ষণিক বট নোটিফিকেশন',
      icon: Send,
      tab: 'telegram',
      statText: 'বট সেটিংস',
    },
    {
      title: 'Auto SMS',
      subtitle: 'বাল্ক ও বেতন এসএমএস',
      icon: MessageSquare,
      tab: 'sms',
      statText: 'SMS গেটওয়ে',
    },
    {
      title: 'কারখানা ও নিরাপত্তা',
      subtitle: 'তথ্য, চুক্তি ও পাসওয়ার্ড',
      icon: Building2,
      tab: 'factory',
      statText: 'সেটিংস',
    },
  ];

  return (
    <div className="space-y-3.5">
      {/* 1. Executive Workspace Header with Direct Admin Login */}
      <section className="bg-white rounded-xl border border-slate-200/90 px-4 sm:px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden">
            <img src="/logo.png" alt={factorySettings.name} className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-extrabold text-slate-950 tracking-tight truncate">
              {factorySettings.name || 'টেক্স ওয়ার অ্যাপারেলস'}
            </h1>
            <div className="flex items-center gap-2 text-[11.5px] text-slate-500 mt-0.5 truncate">
              <span className="truncate">{factorySettings.address}</span>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap font-medium text-slate-600">
                {currentMonthName} {toBengaliNumber(currentYear)} ({formatDateBn(todayIso)})
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('admin')}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="w-4 h-4 text-teal-300 shrink-0" />
            <span>{isAdminSessionActive ? 'অ্যাডমিন প্যানেল' : 'অ্যাডমিন লগইন'}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('form')}
            className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span>নতুন কর্মী</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('user')}
            className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Calculator className="w-3.5 h-3.5 shrink-0" />
            <span>বেতন হিসাব</span>
          </button>
        </div>
      </section>

      {/* 2. Executive 4-Column KPI Strip */}
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => onNavigate('admin')}
          className="bg-white rounded-xl border border-slate-200/90 hover:border-slate-300 px-4 py-3 text-left transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[11.5px] font-medium text-slate-500">
            <span>কর্মরত জনবল</span>
            <Users className="w-4 h-4 text-slate-400 group-hover:text-teal-700 transition-colors" />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-extrabold font-mono text-slate-950 tabular-nums tracking-tight">
              {toBengaliNumber(stats.activeCount)}
              <span className="ml-1.5 text-xs font-sans font-medium text-slate-500">সক্রিয়</span>
            </span>
            <span className="text-[11px] font-medium text-slate-500 tabular-nums">
              রিজাইন <b className="font-mono text-rose-700">{toBengaliNumber(stats.resignedCount)}</b>
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10.5px] text-slate-500 tabular-nums">
            <span>মোট নিবন্ধিত: {toBengaliNumber(stats.totalEmployees)} জন</span>
            <span className="font-semibold text-teal-700">তালিকা →</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('salaries')}
          className="bg-white rounded-xl border border-slate-200/90 hover:border-slate-300 px-4 py-3 text-left transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[11.5px] font-medium text-slate-500">
            <span>চলতি মাস ({currentMonthName})</span>
            <Wallet className="w-4 h-4 text-slate-400 group-hover:text-teal-700 transition-colors" />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-extrabold font-mono text-slate-950 tabular-nums tracking-tight">
              ৳{formatMoney(stats.totalMonthNet)}
            </span>
            <span className="text-[11px] font-medium text-amber-700 tabular-nums">
              বকেয়া ৳{formatMoney(stats.totalMonthDue)}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-700 rounded-full transition-all"
                style={{ width: `${stats.paidRatio}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10.5px] text-slate-500 tabular-nums">
              <span>পরিশোধিত {toBengaliNumber(stats.paidRatio)}%</span>
              <span className="font-semibold text-teal-700">খাতা →</span>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('attendance')}
          className="bg-white rounded-xl border border-slate-200/90 hover:border-slate-300 px-4 py-3 text-left transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[11.5px] font-medium text-slate-500">
            <span>আজকের হাজিরা ও আবেদন</span>
            <Clock className="w-4 h-4 text-slate-400 group-hover:text-teal-700 transition-colors" />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-extrabold font-mono text-slate-950 tabular-nums tracking-tight">
              {toBengaliNumber(stats.todayPresent)}
              <span className="ml-1.5 text-xs font-sans font-medium text-slate-500">উপস্থিত</span>
            </span>
            <span
              className={`text-[11px] font-semibold tabular-nums ${
                pendingApplicationsCount > 0 ? 'text-amber-700' : 'text-slate-500'
              }`}
            >
              আবেদন {toBengaliNumber(pendingApplicationsCount)}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all"
                style={{ width: `${stats.attendanceRatio}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10.5px] text-slate-500 tabular-nums">
              <span>উপস্থিতি হার {toBengaliNumber(stats.attendanceRatio)}%</span>
              <span className="font-semibold text-teal-700">রোস্টার →</span>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('investment')}
          className="bg-white rounded-xl border border-slate-200/90 hover:border-slate-300 px-4 py-3 text-left transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[11.5px] font-medium text-slate-500">
            <span>ইনভেস্টমেন্ট তহবিল</span>
            <TrendingUp className="w-4 h-4 text-slate-400 group-hover:text-teal-700 transition-colors" />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-extrabold font-mono text-slate-950 tabular-nums tracking-tight">
              ৳{formatMoney(stats.totalActiveCapital)}
            </span>
            <span className="text-[11px] font-semibold text-emerald-700 tabular-nums">
              {toBengaliNumber(stats.activeInvestmentsCount)} সক্রিয়
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10.5px] text-slate-500 tabular-nums">
            <span>৭–১২০ দিন মেয়াদি চুক্তি</span>
            <span className="font-semibold text-teal-700">হাব →</span>
          </div>
        </button>
      </section>

      {/* 3. Unified Single-Screen Connected Module Grid (Monochrome Slate + Teal System) */}
      <section className="bg-white rounded-xl border border-slate-200/90 p-3.5">
        <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
          <h2 className="text-xs font-bold text-slate-900 tracking-tight">
            সকল সংযুক্ত অ্যাপ, ড্যাশবোর্ড ও সেটিংস
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('password')}
            className="text-[11.5px] font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5 text-slate-400" />
            <span>নিরাপত্তা ও পাসওয়ার্ড</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          {allModules.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                type="button"
                onClick={() => (item.action ? item.action() : item.tab && onNavigate(item.tab))}
                className={`group p-2.5 rounded-lg border text-left transition-colors duration-150 flex flex-col justify-between gap-2 cursor-pointer ${
                  item.featured
                    ? 'bg-slate-900 hover:bg-slate-800 border-slate-900 text-white'
                    : 'bg-slate-50/70 hover:bg-white border-slate-200/90 hover:border-teal-600/60'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div
                    className={`w-7 h-7 rounded-md border flex items-center justify-center shrink-0 transition-colors duration-150 ${
                      item.featured
                        ? 'bg-slate-800 border-slate-700 text-teal-300'
                        : 'bg-white border-slate-200 text-slate-700 group-hover:bg-teal-700 group-hover:border-teal-700 group-hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <ArrowUpRight
                    className={`w-3.5 h-3.5 transition-colors shrink-0 ${
                      item.featured
                        ? 'text-slate-400 group-hover:text-teal-300'
                        : 'text-slate-300 group-hover:text-teal-700'
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <div
                    className={`text-[11.5px] font-bold truncate ${
                      item.featured ? 'text-white' : 'text-slate-900 group-hover:text-teal-800'
                    }`}
                  >
                    {item.title}
                  </div>
                  <div
                    className={`text-[10px] truncate tabular-nums ${
                      item.featured ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {item.statText || item.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. Operational Activity Feeds */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
        {/* Recent Payroll Records (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200/90 overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900">সাম্প্রতিক বেতন হিসাব</h2>
            <button
              type="button"
              onClick={() => onNavigate('salaries')}
              className="text-[11.5px] font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-0.5 cursor-pointer transition-colors"
            >
              <span>বেতন খাতা</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentSalaries.length > 0 ? (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs border-collapse">
                <tbody className="divide-y divide-slate-100">
                  {recentSalaries.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4">
                        <span className="font-semibold text-slate-900">{rec.employeeName}</span>
                        <span className="ml-2 text-[10.5px] font-mono text-slate-500 tabular-nums">
                          {rec.workerId}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px] whitespace-nowrap">
                        {rec.month} {toBengaliNumber(rec.year)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-950 tabular-nums whitespace-nowrap">
                        ৳{formatMoney(rec.netPayable)}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <span
                          className={`text-[11px] font-semibold ${
                            rec.paymentStatus === 'paid'
                              ? 'text-emerald-700'
                              : rec.paymentStatus === 'pending'
                              ? 'text-amber-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {rec.paymentStatus === 'paid'
                            ? 'পরিশোধিত'
                            : rec.paymentStatus === 'pending'
                            ? 'পেন্ডিং'
                            : 'বকেয়া'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5 text-center text-xs text-slate-500 flex items-center justify-center gap-2 flex-1">
              <Receipt className="w-4 h-4 text-slate-300" />
              <span>এখনো কোনো বেতন রেকর্ড সংরক্ষিত হয়নি</span>
            </div>
          )}
        </div>

        {/* Pending Applications & Active Investments (5 Cols) */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
          {/* Pending Applications Feed */}
          <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden flex flex-col">
            <div className="px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900">পেন্ডিং আবেদন</h2>
              <button
                type="button"
                onClick={() => onNavigate('applications')}
                className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 cursor-pointer"
              >
                সব →
              </button>
            </div>

            {pendingApplications.length > 0 ? (
              <div className="divide-y divide-slate-100 flex-1">
                {pendingApplications.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => onNavigate('applications')}
                    className="w-full px-3.5 py-2 flex items-center justify-between gap-2 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-[11.5px] font-semibold text-slate-900 truncate">{app.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{app.appliedDesignation}</div>
                    </div>
                    <span className="text-[10.5px] font-semibold text-amber-700 shrink-0">
                      পেন্ডিং
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5 flex-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>অপেক্ষমাণ আবেদন নেই</span>
              </div>
            )}
          </div>

          {/* Active Investments Feed */}
          <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden flex flex-col">
            <div className="px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900">সক্রিয় ইনভেস্টমেন্ট</h2>
              <button
                type="button"
                onClick={() => onNavigate('investment')}
                className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 cursor-pointer"
              >
                সব →
              </button>
            </div>

            {activeInvestmentsList.length > 0 ? (
              <div className="divide-y divide-slate-100 flex-1">
                {activeInvestmentsList.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => onNavigate('investment')}
                    className="w-full px-3.5 py-2 flex items-center justify-between gap-2 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-[11.5px] font-semibold text-slate-900 truncate">{inv.investorName}</div>
                      <div className="text-[10px] font-mono text-slate-500 truncate tabular-nums">
                        {toBengaliNumber(inv.durationDays || inv.durationMonths * 30)} দিন
                      </div>
                    </div>
                    <div className="text-[11.5px] font-mono font-bold text-emerald-700 tabular-nums shrink-0">
                      ৳{formatMoney(inv.amount)}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5 flex-1">
                <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                <span>সক্রিয় চুক্তি নেই</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
