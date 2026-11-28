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
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Banknote,
  Shirt,
  Coins,
  CreditCard,
} from 'lucide-react';
import {
  Employee,
  AttendanceRecord,
  SalaryDisbursementRecord,
  InvestmentRecord,
  InvestmentWithdrawalRecord,
  JobApplication,
  FactorySettings,
} from '../types';
import {
  subscribeAttendanceRecords,
  subscribeSalaryRecords,
  subscribeInvestments,
  subscribeWithdrawals,
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

const SHORT_BENGALI_MONTHS = [
  'জানু',
  'ফেব',
  'মার্চ',
  'এপ্রি',
  'মে',
  'জুন',
  'জুলা',
  'আগ',
  'সেপ্ট',
  'অক্টো',
  'নভে',
  'ডিসে',
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
}

function buildSmoothSvgPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const ctrlX = (curr.x + next.x) / 2;
    d += ` C ${ctrlX.toFixed(2)} ${curr.y.toFixed(2)}, ${ctrlX.toFixed(2)} ${next.y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }
  return d;
}

const MiniSparkline: React.FC<{ values: number[]; id: string }> = ({ values, id }) => {
  const safeValues = values.length >= 2 ? values : [10, 14, 12, 18, 16, 22, 20];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = max - min || 1;
  const w = 140;
  const h = 28;
  const pts = safeValues.map((v, idx) => ({
    x: (idx / (safeValues.length - 1)) * w,
    y: h - 4 - ((v - min) / range) * (h - 8),
  }));
  const linePath = buildSmoothSvgPath(pts);
  const areaPath = `${linePath} L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-7 overflow-visible" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-${id})`} />
      <path d={linePath} fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.92" />
    </svg>
  );
};

export const CommandDashboard: React.FC<CommandDashboardProps> = ({
  employees,
  pendingApplicationsCount,
  onNavigate,
  onOpenInstallModal,
}) => {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<SalaryDisbursementRecord[]>([]);
  const [investments, setInvestments] = useState<InvestmentRecord[]>([]);
  const [withdrawals, setWithdrawals] = useState<InvestmentWithdrawalRecord[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [factorySettings, setFactorySettings] = useState<FactorySettings>(DEFAULT_FACTORY_SETTINGS);
  const [overviewMode, setOverviewMode] = useState<'payroll' | 'attendance'>('payroll');
  const [hoveredChartIdx, setHoveredChartIdx] = useState<number | null>(null);

  useEffect(() => {
    const unsubAtt = subscribeAttendanceRecords(setAttendanceRecords);
    const unsubSal = subscribeSalaryRecords(setSalaryRecords);
    const unsubInv = subscribeInvestments(setInvestments);
    const unsubWth = subscribeWithdrawals(setWithdrawals);
    const unsubApp = subscribeJobApplications(setApplications);
    loadFactorySettings().then(setFactorySettings).catch(() => {});

    return () => {
      unsubAtt();
      unsubSal();
      unsubInv();
      unsubWth();
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
    const inactiveOtherCount = employees.filter((e) => e.status === 'suspended' || e.status === 'terminated').length;

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
    const totalWithdrawalsAmount = withdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0);

    return {
      activeEmployees,
      activeCount: activeEmployees.length,
      resignedCount,
      inactiveOtherCount,
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
      totalWithdrawalsAmount,
      withdrawalsCount: withdrawals.length,
    };
  }, [employees, salaryRecords, attendanceRecords, investments, withdrawals, currentMonthName, currentYear, todayIso]);

  // Last 6 months payroll trend (real monthly data)
  const monthlySeries = useMemo(() => {
    const buckets: { label: string; monthName: string; year: number; net: number; paid: number }[] = [];
    for (let offset = 5; offset >= 0; offset--) {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const mIdx = d.getMonth();
      const y = d.getFullYear();
      const mName = BENGALI_MONTHS[mIdx];
      const matches = salaryRecords.filter((r) => r.month === mName && Number(r.year) === y);
      buckets.push({
        label: SHORT_BENGALI_MONTHS[mIdx],
        monthName: mName,
        year: y,
        net: matches.reduce((s, r) => s + Number(r.netPayable || 0), 0),
        paid: matches.reduce((s, r) => s + Number(r.paidAmount || 0), 0),
      });
    }
    return buckets;
  }, [salaryRecords, now.getMonth(), now.getFullYear()]);

  // Last 7 days attendance trend (real daily attendance)
  const weeklyAttendanceSeries = useMemo(() => {
    const buckets: { label: string; present: number; otHours: number }[] = [];
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(now);
      d.setDate(now.getDate() - offset);
      const iso = d.toISOString().split('T')[0];
      const dayLabel = `${toBengaliNumber(d.getDate())}/${toBengaliNumber(d.getMonth() + 1)}`;
      const recs = attendanceRecords.filter((a) => a.date === iso);
      const present = recs.filter(
        (a) => a.status === 'present' || a.status === 'late' || a.status === 'half_day'
      ).length;
      const otHours = recs.reduce((s, a) => s + Number(a.otHours || 0), 0);
      buckets.push({ label: dayLabel, present, otHours });
    }
    return buckets;
  }, [attendanceRecords, todayIso]);

  // Department / Designation Distribution (real active employees)
  const departmentBreakdown = useMemo(() => {
    const palette = ['#F59E0B', '#2563EB', '#16A34A', '#7C3AED', '#EC4899'];
    const barClasses = ['bg-blue-600', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-rose-500'];
    const map = new Map<string, { name: string; count: number; totalSalary: number }>();

    const source = stats.activeEmployees.length > 0 ? stats.activeEmployees : employees;
    source.forEach((emp) => {
      const dept = (emp.department || emp.designation || 'সাধারণ বিভাগ').trim();
      const prev = map.get(dept) || { name: dept, count: 0, totalSalary: 0 };
      prev.count += 1;
      prev.totalSalary += Number(emp.salary || 0);
      map.set(dept, prev);
    });

    const sorted = Array.from(map.values()).sort((a, b) => b.count - a.count);
    const top4 = sorted.slice(0, 4);
    if (sorted.length > 4) {
      const rest = sorted.slice(4).reduce(
        (acc, item) => ({
          name: 'অন্যান্য বিভাগ',
          count: acc.count + item.count,
          totalSalary: acc.totalSalary + item.totalSalary,
        }),
        { name: 'অন্যান্য বিভাগ', count: 0, totalSalary: 0 }
      );
      top4.push(rest);
    }

    const totalCount = top4.reduce((s, d) => s + d.count, 0) || 1;
    const maxSalary = Math.max(...top4.map((d) => d.totalSalary), 1);

    return top4.map((item, idx) => ({
      ...item,
      percent: Math.round((item.count / totalCount) * 100),
      salaryRatio: Math.round((item.totalSalary / maxSalary) * 100),
      color: palette[idx % palette.length],
      barClass: barClasses[idx % barClasses.length],
    }));
  }, [stats.activeEmployees, employees]);

  // Top 5 Active Workers sorted by base salary
  const topWorkers = useMemo(() => {
    const pool = stats.activeEmployees.length > 0 ? stats.activeEmployees : employees;
    return [...pool].sort((a, b) => Number(b.salary || 0) - Number(a.salary || 0)).slice(0, 5);
  }, [stats.activeEmployees, employees]);

  // Attention / Alert items (Pending Applications + Due/Pending Salaries)
  const alertItems = useMemo(() => {
    const list: {
      id: string;
      title: string;
      subtitle: string;
      meta: string;
      statusLabel: string;
      severity: 'critical' | 'warning';
      targetTab: AppMode;
    }[] = [];

    applications
      .filter((a) => a.status === 'pending')
      .slice(0, 3)
      .forEach((app) => {
        list.push({
          id: `app_${app.id}`,
          title: app.name,
          subtitle: app.appliedDesignation || 'নতুন আবেদন',
          meta: app.applicationNo,
          statusLabel: 'আবেদন পেন্ডিং',
          severity: 'warning',
          targetTab: 'applications',
        });
      });

    salaryRecords
      .filter((r) => r.paymentStatus !== 'paid')
      .slice(0, 3)
      .forEach((rec) => {
        const due = Math.max(0, Number(rec.netPayable || 0) - Number(rec.paidAmount || 0));
        list.push({
          id: `sal_${rec.id}`,
          title: rec.employeeName,
          subtitle: `${rec.month} ${toBengaliNumber(rec.year)}`,
          meta: `৳${formatMoney(due || rec.netPayable)}`,
          statusLabel: rec.paymentStatus === 'pending' ? 'বেতন পেন্ডিং' : 'বেতন বকেয়া',
          severity: 'critical',
          targetTab: 'salaries',
        });
      });

    return list.slice(0, 4);
  }, [applications, salaryRecords]);

  // Recent Unified Activities / Transactions Feed
  const recentActivities = useMemo(() => {
    const items: {
      id: string;
      code: string;
      title: string;
      amountText: string;
      timeText: string;
      ts: number;
      tone: 'blue' | 'emerald' | 'rose' | 'amber';
      targetTab: AppMode;
    }[] = [];

    salaryRecords.slice(0, 4).forEach((s) => {
      items.push({
        id: `s_${s.id}`,
        code: `PAY-${s.workerId}`,
        title: `বেতন: ${s.employeeName}`,
        amountText: `৳${formatMoney(s.netPayable)}`,
        timeText: s.month,
        ts: s.paidAt || s.statusUpdatedAt || 0,
        tone: s.paymentStatus === 'paid' ? 'emerald' : 'amber',
        targetTab: 'salaries',
      });
    });

    investments.slice(0, 3).forEach((inv) => {
      items.push({
        id: `i_${inv.id}`,
        code: inv.agreementNo || inv.investorCode || 'INV',
        title: `ইনভেস্ট: ${inv.investorName}`,
        amountText: `৳${formatMoney(inv.amount)}`,
        timeText: inv.investmentDate ? formatDateBn(inv.investmentDate) : 'চুক্তি',
        ts: inv.createdAt || 0,
        tone: inv.status === 'cancelled' ? 'rose' : 'blue',
        targetTab: 'investment',
      });
    });

    withdrawals.slice(0, 2).forEach((w) => {
      items.push({
        id: `w_${w.id}`,
        code: w.voucherNo || w.agreementNo,
        title: `উত্তোলন: ${w.investorName}`,
        amountText: `৳${formatMoney(w.amount)}`,
        timeText: w.withdrawalDate ? formatDateBn(w.withdrawalDate) : 'ভাউচার',
        ts: w.createdAt || 0,
        tone: 'rose',
        targetTab: 'investment',
      });
    });

    return items.sort((a, b) => b.ts - a.ts).slice(0, 5);
  }, [salaryRecords, investments, withdrawals]);

  // All 16 connected modules in one quick strip
  const allModules: ModuleTile[] = [
    {
      title: isAdminSessionActive ? 'অ্যাডমিন প্যানেল' : 'অ্যাডমিন লগইন',
      subtitle: 'কন্ট্রোল',
      icon: ShieldCheck,
      featured: true,
      tab: 'admin',
    },
    { title: 'বেতন ক্যালকুলেটর', subtitle: '৫৮মিমি স্লিপ', icon: Calculator, tab: 'user' },
    { title: 'কর্মী তালিকা', subtitle: 'সক্রিয় স্ট্যাটাস', icon: Users, tab: 'admin' },
    { title: 'দৈনিক হাজিরা', subtitle: 'ইন-আউট', icon: Clock, tab: 'attendance' },
    { title: 'বেতন খাতা', subtitle: 'A4 শীট', icon: Receipt, tab: 'salaries' },
    { title: 'আবেদন যাচাই', subtitle: 'নিয়োগ পোর্টাল', icon: FileText, tab: 'applications' },
    { title: 'নতুন কর্মী', subtitle: 'TWA নিবন্ধন', icon: UserPlus, tab: 'form' },
    { title: 'প্রোফাইল প্রিন্ট', subtitle: 'আইডি ও চুক্তি', icon: IdCard, tab: 'details' },
    { title: 'ইনভেস্টমেন্ট', subtitle: 'তহবিল হাব', icon: TrendingUp, tab: 'investment' },
    { title: 'ইনভেস্টর পোর্টাল', subtitle: 'অংশীদার লগইন', icon: Briefcase, tab: 'investor' },
    { title: 'শ্রমিক পোর্টাল', subtitle: 'শ্রমিক অ্যাপ', icon: UserCheck, tab: 'worker' },
    { title: 'নিয়োগ ফরম', subtitle: 'পাবলিক লিংক', icon: FilePlus2, tab: 'apply' },
    { title: 'অ্যাপ ইনস্টল', subtitle: 'PWA ডাউনলোড', icon: Smartphone, action: onOpenInstallModal },
    { title: 'Telegram Bot', subtitle: 'বট এলার্ট', icon: Send, tab: 'telegram' },
    { title: 'Auto SMS', subtitle: 'SMS গেটওয়ে', icon: MessageSquare, tab: 'sms' },
    { title: 'কারখানা সেটিংস', subtitle: 'নিরাপত্তা ও তথ্য', icon: Building2, tab: 'factory' },
  ];

  // Financial Summary Rows for Row 2 Col 3
  const financialTotal =
    stats.totalMonthPaid + stats.totalMonthDue + stats.totalActiveCapital + stats.totalWithdrawalsAmount;
  const pctOfFinancial = (val: number) =>
    financialTotal > 0 ? Math.round((val / financialTotal) * 100) : 0;

  // Dual Line Chart Data Preparation
  const activeChartData = useMemo(() => {
    if (overviewMode === 'payroll') {
      return monthlySeries.map((m) => ({
        label: m.label,
        primaryLabel: 'মোট বেতন',
        secondaryLabel: 'পরিশোধিত',
        primaryVal: m.net,
        secondaryVal: m.paid,
        formatFn: (v: number) => `৳${formatMoney(v)}`,
      }));
    }
    return weeklyAttendanceSeries.map((d) => ({
      label: d.label,
      primaryLabel: 'উপস্থিত কর্মী',
      secondaryLabel: 'মোট OT (ঘণ্টা)',
      primaryVal: d.present,
      secondaryVal: Math.round(d.otHours),
      formatFn: (v: number) => `${toBengaliNumber(v)}`,
    }));
  }, [overviewMode, monthlySeries, weeklyAttendanceSeries]);

  const chartSvg = useMemo(() => {
    const W = 440;
    const H = 185;
    const padL = 42;
    const padR = 14;
    const padT = 16;
    const padB = 26;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const maxVal = Math.max(
      ...activeChartData.flatMap((d) => [d.primaryVal, d.secondaryVal]),
      10
    );
    const niceMax = Math.ceil(maxVal * 1.15);

    const primaryPts = activeChartData.map((d, i) => ({
      x: padL + (i / Math.max(1, activeChartData.length - 1)) * plotW,
      y: padT + plotH - (d.primaryVal / niceMax) * plotH,
    }));
    const secondaryPts = activeChartData.map((d, i) => ({
      x: padL + (i / Math.max(1, activeChartData.length - 1)) * plotW,
      y: padT + plotH - (d.secondaryVal / niceMax) * plotH,
    }));

    const primaryLine = buildSmoothSvgPath(primaryPts);
    const secondaryLine = buildSmoothSvgPath(secondaryPts);
    const primaryArea =
      primaryPts.length > 0
        ? `${primaryLine} L ${primaryPts[primaryPts.length - 1].x} ${padT + plotH} L ${primaryPts[0].x} ${padT + plotH} Z`
        : '';
    const secondaryArea =
      secondaryPts.length > 0
        ? `${secondaryLine} L ${secondaryPts[secondaryPts.length - 1].x} ${padT + plotH} L ${secondaryPts[0].x} ${padT + plotH} Z`
        : '';

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      val: Math.round(niceMax * t),
      y: padT + plotH - t * plotH,
    }));

    return { W, H, padL, padT, plotH, primaryPts, secondaryPts, primaryLine, secondaryLine, primaryArea, secondaryArea, yTicks };
  }, [activeChartData]);

  // Donut Chart SVG Segments
  const donutSegments = useMemo(() => {
    const r = 48;
    const c = 2 * Math.PI * r;
    let accumulated = 0;
    if (departmentBreakdown.length === 0) {
      return [{ offset: 0, dash: c, color: '#E2E8F0' }];
    }
    return departmentBreakdown.map((seg) => {
      const len = (seg.percent / 100) * c;
      const slice = {
        offset: -accumulated,
        dash: `${Math.max(2, len - 2)} ${c}`,
        color: seg.color,
      };
      accumulated += len;
      return slice;
    });
  }, [departmentBreakdown]);

  // Monthly Bar Chart max
  const maxBarVal = Math.max(...monthlySeries.map((m) => m.net), 1);

  return (
    <div className="space-y-3.5">
      {/* ROW 1: 6 Vibrant Gradient KPI Cards with Sparklines (Reference Screenshot Top Ribbon) */}
      <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* 1. Violet/Indigo — Active Workers */}
        <button
          type="button"
          onClick={() => onNavigate('admin')}
          className="rounded-xl bg-gradient-to-br from-[#635BFF] to-[#4338CA] text-white p-3.5 text-left shadow-sm hover:brightness-105 transition cursor-pointer flex flex-col justify-between gap-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-indigo-100 truncate">কর্মরত জনবল</div>
              <div className="text-xl font-extrabold font-mono tabular-nums tracking-tight mt-0.5">
                {toBengaliNumber(stats.activeCount)} <span className="text-xs font-sans font-semibold">জন</span>
              </div>
              <div className="text-[10.5px] text-indigo-100/90 tabular-nums mt-0.5 truncate">
                নিবন্ধিত {toBengaliNumber(stats.totalEmployees)} জন
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Users className="w-4.5 h-4.5 text-white" />
            </div>
          </div>
          <MiniSparkline id="workers" values={[stats.activeCount || 1, stats.totalEmployees || 2, stats.activeCount + 1, stats.totalEmployees || 3]} />
        </button>

        {/* 2. Emerald — This Month Payroll */}
        <button
          type="button"
          onClick={() => onNavigate('salaries')}
          className="rounded-xl bg-gradient-to-br from-[#059669] to-[#16A34A] text-white p-3.5 text-left shadow-sm hover:brightness-105 transition cursor-pointer flex flex-col justify-between gap-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-emerald-100 truncate">চলতি মাস ({currentMonthName})</div>
              <div className="text-xl font-extrabold font-mono tabular-nums tracking-tight mt-0.5 truncate">
                ৳{formatMoney(stats.totalMonthNet)}
              </div>
              <div className="text-[10.5px] text-emerald-100/90 tabular-nums mt-0.5 truncate">
                ▲ পরিশোধিত {toBengaliNumber(stats.paidRatio)}%
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Wallet className="w-4.5 h-4.5 text-white" />
            </div>
          </div>
          <MiniSparkline id="payroll" values={monthlySeries.map((m) => m.net)} />
        </button>

        {/* 3. Orange — Today's Attendance */}
        <button
          type="button"
          onClick={() => onNavigate('attendance')}
          className="rounded-xl bg-gradient-to-br from-[#F97316] to-[#EA580C] text-white p-3.5 text-left shadow-sm hover:brightness-105 transition cursor-pointer flex flex-col justify-between gap-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-orange-100 truncate">আজকের উপস্থিতি</div>
              <div className="text-xl font-extrabold font-mono tabular-nums tracking-tight mt-0.5">
                {toBengaliNumber(stats.todayPresent)} <span className="text-xs font-sans font-semibold">জন</span>
              </div>
              <div className="text-[10.5px] text-orange-100/90 tabular-nums mt-0.5 truncate">
                ▲ উপস্থিতি হার {toBengaliNumber(stats.attendanceRatio)}%
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Clock className="w-4.5 h-4.5 text-white" />
            </div>
          </div>
          <MiniSparkline id="att" values={weeklyAttendanceSeries.map((d) => d.present)} />
        </button>

        {/* 4. Blue — Active Investment Capital */}
        <button
          type="button"
          onClick={() => onNavigate('investment')}
          className="rounded-xl bg-gradient-to-br from-[#0284C7] to-[#2563EB] text-white p-3.5 text-left shadow-sm hover:brightness-105 transition cursor-pointer flex flex-col justify-between gap-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-sky-100 truncate">ইনভেস্টমেন্ট তহবিল</div>
              <div className="text-xl font-extrabold font-mono tabular-nums tracking-tight mt-0.5 truncate">
                ৳{formatMoney(stats.totalActiveCapital)}
              </div>
              <div className="text-[10.5px] text-sky-100/90 tabular-nums mt-0.5 truncate">
                {toBengaliNumber(stats.activeInvestmentsCount)}টি সক্রিয় চুক্তি
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4.5 h-4.5 text-white" />
            </div>
          </div>
          <MiniSparkline
            id="inv"
            values={investments.slice(0, 6).map((i) => Number(i.amount || 0))}
          />
        </button>

        {/* 5. Pink/Rose — Job Applications */}
        <button
          type="button"
          onClick={() => onNavigate('applications')}
          className="rounded-xl bg-gradient-to-br from-[#EC4899] to-[#DB2777] text-white p-3.5 text-left shadow-sm hover:brightness-105 transition cursor-pointer flex flex-col justify-between gap-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-pink-100 truncate">চাকরির আবেদন</div>
              <div className="text-xl font-extrabold font-mono tabular-nums tracking-tight mt-0.5">
                {toBengaliNumber(pendingApplicationsCount)} <span className="text-xs font-sans font-semibold">পেন্ডিং</span>
              </div>
              <div className="text-[10.5px] text-pink-100/90 tabular-nums mt-0.5 truncate">
                মোট {toBengaliNumber(applications.length)}টি আবেদন
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <FileText className="w-4.5 h-4.5 text-white" />
            </div>
          </div>
          <MiniSparkline
            id="apps"
            values={[applications.length || 1, pendingApplicationsCount + 2, applications.length + 1, pendingApplicationsCount + 1]}
          />
        </button>

        {/* 6. Cyan/Teal — Due Payroll / Calculator */}
        <button
          type="button"
          onClick={() => onNavigate('user')}
          className="rounded-xl bg-gradient-to-br from-[#06B6D4] to-[#0D9488] text-white p-3.5 text-left shadow-sm hover:brightness-105 transition cursor-pointer flex flex-col justify-between gap-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-cyan-100 truncate">বকেয়া বেতন ও হিসাব</div>
              <div className="text-xl font-extrabold font-mono tabular-nums tracking-tight mt-0.5 truncate">
                ৳{formatMoney(stats.totalMonthDue)}
              </div>
              <div className="text-[10.5px] text-cyan-100/90 tabular-nums mt-0.5 truncate">
                পরিশোধ ৳{formatMoney(stats.totalMonthPaid)}
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Calculator className="w-4.5 h-4.5 text-white" />
            </div>
          </div>
          <MiniSparkline id="due" values={monthlySeries.map((m) => Math.max(0, m.net - m.paid))} />
        </button>
      </section>

      {/* QUICK CONNECTED MODULES & SETTINGS BAR (All 16 Apps Connected in One Place) */}
      <section className="bg-white rounded-xl border border-slate-200/90 px-3.5 py-3 shadow-xs">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <span>সকল সংযুক্ত অ্যাপ, পোর্টাল ও সেটিংস</span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="text-[11px] font-medium text-slate-500">
              {factorySettings.name || 'টেক্স ওয়ার অ্যাপারেলস'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('password')}
            className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>পাসওয়ার্ড ও নিরাপত্তা</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {allModules.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                type="button"
                onClick={() => (item.action ? item.action() : item.tab && onNavigate(item.tab))}
                className={`group px-2.5 py-2 rounded-lg border text-left transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                  item.featured
                    ? 'bg-[#0B1736] hover:bg-[#14295E] border-[#0B1736] text-white'
                    : 'bg-slate-50/70 hover:bg-blue-50/60 border-slate-200/80 hover:border-blue-300'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    item.featured
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-200 text-blue-700 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div
                    className={`text-[11.5px] font-bold truncate ${
                      item.featured ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {item.title}
                  </div>
                  <div
                    className={`text-[10px] truncate ${
                      item.featured ? 'text-blue-200' : 'text-slate-500'
                    }`}
                  >
                    {item.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ROW 2: 3-Column Analytics (Dual Area Chart + Donut Chart + Payroll/Capital Summary) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
        {/* Col 1 (5 Cols): Dual Smooth Area Chart */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">বেতন ও উপস্থিতি ওভারভিউ</h2>
              <div className="flex items-center gap-4 mt-1 text-[11px] font-semibold">
                <span className="flex items-center gap-1.5 text-blue-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                  <span>{overviewMode === 'payroll' ? 'মোট প্রদেয় (৳)' : 'উপস্থিত কর্মী'}</span>
                </span>
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  <span>{overviewMode === 'payroll' ? 'পরিশোধিত (৳)' : 'ওভারটাইম (ঘণ্টা)'}</span>
                </span>
              </div>
            </div>

            <select
              value={overviewMode}
              onChange={(e) => setOverviewMode(e.target.value as 'payroll' | 'attendance')}
              aria-label="চার্ট মোড নির্বাচন করুন"
              className="text-[11.5px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="payroll">গত ৬ মাস (বেতন)</option>
              <option value="attendance">গত ৭ দিন (হাজিরা)</option>
            </select>
          </div>

          <div className="relative w-full">
            <svg viewBox={`0 0 ${chartSvg.W} ${chartSvg.H}`} className="w-full h-48 overflow-visible">
              <defs>
                <linearGradient id="areaBlueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0.01" />
                </linearGradient>
                <linearGradient id="areaGreenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16A34A" stopOpacity="0.20" />
                  <stop offset="100%" stopColor="#16A34A" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {chartSvg.yTicks.map((tick, idx) => (
                <g key={idx}>
                  <line
                    x1={chartSvg.padL}
                    x2={chartSvg.W - 14}
                    y1={tick.y}
                    y2={tick.y}
                    stroke="#E2E8F0"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={chartSvg.padL - 6}
                    y={tick.y + 3}
                    textAnchor="end"
                    className="fill-slate-400 text-[9.5px] font-mono"
                  >
                    {overviewMode === 'payroll' && tick.val >= 1000
                      ? `${Math.round(tick.val / 1000)}k`
                      : toBengaliNumber(tick.val)}
                  </text>
                </g>
              ))}

              {chartSvg.primaryArea && <path d={chartSvg.primaryArea} fill="url(#areaBlueGrad)" />}
              {chartSvg.secondaryArea && <path d={chartSvg.secondaryArea} fill="url(#areaGreenGrad)" />}

              {chartSvg.primaryLine && (
                <path d={chartSvg.primaryLine} fill="none" stroke="#2563EB" strokeWidth="2.4" strokeLinecap="round" />
              )}
              {chartSvg.secondaryLine && (
                <path d={chartSvg.secondaryLine} fill="none" stroke="#16A34A" strokeWidth="2.4" strokeLinecap="round" />
              )}

              {activeChartData.map((d, i) => {
                const p1 = chartSvg.primaryPts[i];
                const p2 = chartSvg.secondaryPts[i];
                const isHovered = hoveredChartIdx === i;
                return (
                  <g
                    key={d.label}
                    onMouseEnter={() => setHoveredChartIdx(i)}
                    onMouseLeave={() => setHoveredChartIdx(null)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={p1.x - 22}
                      y={chartSvg.padT}
                      width={44}
                      height={chartSvg.plotH + 20}
                      fill="transparent"
                    />
                    {isHovered && (
                      <line
                        x1={p1.x}
                        x2={p1.x}
                        y1={chartSvg.padT}
                        y2={chartSvg.padT + chartSvg.plotH}
                        stroke="#94A3B8"
                        strokeDasharray="2 2"
                      />
                    )}
                    <circle
                      cx={p1.x}
                      cy={p1.y}
                      r={isHovered ? 5 : 3.5}
                      fill="#ffffff"
                      stroke="#2563EB"
                      strokeWidth="2.2"
                    />
                    <circle
                      cx={p2.x}
                      cy={p2.y}
                      r={isHovered ? 5 : 3.5}
                      fill="#ffffff"
                      stroke="#16A34A"
                      strokeWidth="2.2"
                    />
                    <text
                      x={p1.x}
                      y={chartSvg.H - 6}
                      textAnchor="middle"
                      className="fill-slate-500 text-[10px] font-medium"
                    >
                      {d.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {hoveredChartIdx !== null && activeChartData[hoveredChartIdx] && (
              <div className="mt-1 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] flex items-center justify-between tabular-nums">
                <span className="font-semibold">{activeChartData[hoveredChartIdx].label}</span>
                <span>
                  {activeChartData[hoveredChartIdx].primaryLabel}:{' '}
                  <b className="font-mono">{activeChartData[hoveredChartIdx].formatFn(activeChartData[hoveredChartIdx].primaryVal)}</b>
                  {' · '}
                  {activeChartData[hoveredChartIdx].secondaryLabel}:{' '}
                  <b className="font-mono text-emerald-300">{activeChartData[hoveredChartIdx].formatFn(activeChartData[hoveredChartIdx].secondaryVal)}</b>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Col 2 (3 Cols): Department / Section Donut Chart */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-900">বিভাগ অনুযায়ী কর্মী</h2>
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
            >
              তালিকা →
            </button>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-4 my-auto py-1">
            <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 124 124" className="w-full h-full -rotate-90">
                <circle cx="62" cy="62" r="48" fill="none" stroke="#F1F5F9" strokeWidth="18" />
                {donutSegments.map((seg, idx) => (
                  <circle
                    key={idx}
                    cx="62"
                    cy="62"
                    r="48"
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="18"
                    strokeDasharray={seg.dash}
                    strokeDashoffset={seg.offset}
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <Shirt className="w-5 h-5 text-slate-700" />
                <span className="text-xs font-mono font-extrabold text-slate-900 tabular-nums mt-0.5">
                  {toBengaliNumber(stats.activeCount)}
                </span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-2 min-w-0">
              {departmentBreakdown.length > 0 ? (
                departmentBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-slate-700 font-medium truncate">{item.name}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 tabular-nums shrink-0">
                      {toBengaliNumber(item.percent)}%
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500 text-center">কোনো কর্মী নিবন্ধিত নেই</div>
              )}
            </div>
          </div>
        </div>

        {/* Col 3 (4 Cols): Financial & Payroll Summary */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-bold text-slate-900">
              বেতন ও তহবিল সারসংক্ষেপ ({currentMonthName})
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            <button
              type="button"
              onClick={() => onNavigate('salaries')}
              className="w-full py-2 flex items-center justify-between gap-2 hover:bg-slate-50/80 rounded-lg px-1.5 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Banknote className="w-4 h-4" />
                </span>
                <span className="text-xs font-semibold text-slate-800 truncate">পরিশোধিত বেতন</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 tabular-nums">
                <span className="font-mono text-xs font-bold text-slate-900">
                  ৳{formatMoney(stats.totalMonthPaid)}
                </span>
                <span className="font-mono text-[11px] font-semibold text-slate-500 w-9 text-right">
                  {toBengaliNumber(pctOfFinancial(stats.totalMonthPaid))}%
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('salaries')}
              className="w-full py-2 flex items-center justify-between gap-2 hover:bg-slate-50/80 rounded-lg px-1.5 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4" />
                </span>
                <span className="text-xs font-semibold text-slate-800 truncate">বকেয়া বেতন</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 tabular-nums">
                <span className="font-mono text-xs font-bold text-slate-900">
                  ৳{formatMoney(stats.totalMonthDue)}
                </span>
                <span className="font-mono text-[11px] font-semibold text-slate-500 w-9 text-right">
                  {toBengaliNumber(pctOfFinancial(stats.totalMonthDue))}%
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('investment')}
              className="w-full py-2 flex items-center justify-between gap-2 hover:bg-slate-50/80 rounded-lg px-1.5 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <Coins className="w-4 h-4" />
                </span>
                <span className="text-xs font-semibold text-slate-800 truncate">সক্রিয় ইনভেস্টমেন্ট</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 tabular-nums">
                <span className="font-mono text-xs font-bold text-slate-900">
                  ৳{formatMoney(stats.totalActiveCapital)}
                </span>
                <span className="font-mono text-[11px] font-semibold text-slate-500 w-9 text-right">
                  {toBengaliNumber(pctOfFinancial(stats.totalActiveCapital))}%
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('investment')}
              className="w-full py-2 flex items-center justify-between gap-2 hover:bg-slate-50/80 rounded-lg px-1.5 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <Briefcase className="w-4 h-4" />
                </span>
                <span className="text-xs font-semibold text-slate-800 truncate">মোট উত্তোলন / মুনাফা</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 tabular-nums">
                <span className="font-mono text-xs font-bold text-slate-900">
                  ৳{formatMoney(stats.totalWithdrawalsAmount)}
                </span>
                <span className="font-mono text-[11px] font-semibold text-slate-500 w-9 text-right">
                  {toBengaliNumber(pctOfFinancial(stats.totalWithdrawalsAmount))}%
                </span>
              </div>
            </button>
          </div>

          <div className="pt-2.5 mt-1 border-t border-slate-200 flex items-center justify-between px-1.5">
            <span className="text-xs font-bold text-slate-900">মোট হিসাব ও তহবিল</span>
            <span className="text-base font-mono font-extrabold text-emerald-700 tabular-nums">
              ৳{formatMoney(financialTotal)}
            </span>
          </div>
        </div>
      </section>

      {/* ROW 3: 3-Column Operational Tables & Alerts */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
        {/* Col 1 (5 Cols): Top 5 Active Workers */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 mb-3">শীর্ষ ৫ কর্মী ও বেতন তালিকা</h2>
            {topWorkers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] text-slate-500">
                      <th className="py-2 px-2.5 font-semibold">#</th>
                      <th className="py-2 px-2.5 font-semibold">কর্মীর নাম</th>
                      <th className="py-2 px-2.5 font-semibold">পদবি</th>
                      <th className="py-2 px-2.5 font-semibold text-right">মূল বেতন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {topWorkers.map((emp, idx) => (
                      <tr
                        key={emp.id}
                        onClick={() => onNavigate('details')}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="py-2 px-2.5 font-mono text-slate-500 tabular-nums">
                          {toBengaliNumber(idx + 1)}
                        </td>
                        <td className="py-2 px-2.5">
                          <div className="font-semibold text-slate-900 truncate max-w-[140px]">{emp.name}</div>
                          <div className="text-[10.5px] font-mono text-slate-400 tabular-nums">{emp.workerId}</div>
                        </td>
                        <td className="py-2 px-2.5 text-slate-600 truncate max-w-[120px]">
                          {emp.designation || 'শ্রমিক'}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                          ৳{formatMoney(emp.salary)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                কোনো কর্মী যুক্ত করা হয়নি
              </div>
            )}
          </div>

          <div className="pt-3 mt-2 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className="text-xs font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>সব কর্মী দেখুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Col 2 (3 Cols): Workforce & System Summary */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 mb-3">কারখানা সারসংক্ষেপ</h2>
            <div className="divide-y divide-slate-100">
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="w-full py-2 flex items-center justify-between text-xs hover:bg-slate-50 rounded-lg px-1 cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2 text-slate-700 font-medium">
                  <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Users className="w-3.5 h-3.5" />
                  </span>
                  <span>সক্রিয় কর্মী</span>
                </span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {toBengaliNumber(stats.activeCount)} জন
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="w-full py-2 flex items-center justify-between text-xs hover:bg-slate-50 rounded-lg px-1 cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2 text-slate-700 font-medium">
                  <span className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <UserPlus className="w-3.5 h-3.5" />
                  </span>
                  <span>রিজাইন / অব্যাহতি</span>
                </span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {toBengaliNumber(stats.resignedCount + stats.inactiveOtherCount)} জন
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('attendance')}
                className="w-full py-2 flex items-center justify-between text-xs hover:bg-slate-50 rounded-lg px-1 cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2 text-slate-700 font-medium">
                  <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                  </span>
                  <span>আজকের উপস্থিতি</span>
                </span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {toBengaliNumber(stats.attendanceRatio)}%
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('investment')}
                className="w-full py-2 flex items-center justify-between text-xs hover:bg-slate-50 rounded-lg px-1 cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2 text-slate-700 font-medium">
                  <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </span>
                  <span>সক্রিয় বিনিয়োগ</span>
                </span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {toBengaliNumber(stats.activeInvestmentsCount)} টি
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('telegram')}
                className="w-full py-2 flex items-center justify-between text-xs hover:bg-slate-50 rounded-lg px-1 cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2 text-slate-700 font-medium">
                  <span className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                    <Send className="w-3.5 h-3.5" />
                  </span>
                  <span>Telegram ও SMS</span>
                </span>
                <span className="font-semibold text-blue-700">সেটআপ →</span>
              </button>
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => onNavigate('details')}
              className="text-xs font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>প্রোফাইল ও রিপোর্ট দেখুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Col 3 (4 Cols): Attention & Alerts Card (Soft Rose Header matching reference Low Stock Alert) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-rose-200/80 overflow-hidden shadow-xs flex flex-col justify-between">
          <div>
            <div className="px-4 py-3 bg-rose-50/80 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>অপেক্ষমাণ আবেদন ও বকেয়া সতর্কতা</span>
              </div>
              <span className="text-[11px] font-mono font-bold text-rose-700 tabular-nums">
                {toBengaliNumber(alertItems.length)} টি
              </span>
            </div>

            {alertItems.length > 0 ? (
              <div className="overflow-x-auto px-3 py-2">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] text-slate-500">
                      <th className="py-1.5 px-2 font-semibold">নাম</th>
                      <th className="py-1.5 px-2 font-semibold">বিবরণ</th>
                      <th className="py-1.5 px-2 font-semibold text-right">স্ট্যাটাস</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {alertItems.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => onNavigate(item.targetTab)}
                        className="hover:bg-rose-50/40 cursor-pointer transition-colors"
                      >
                        <td className="py-2 px-2 font-semibold text-slate-900 truncate max-w-[115px]">
                          {item.title}
                        </td>
                        <td className="py-2 px-2 text-slate-600 truncate max-w-[110px]">
                          <span className="block truncate">{item.subtitle}</span>
                          <span className="text-[10px] font-mono text-slate-400 tabular-nums">{item.meta}</span>
                        </td>
                        <td className="py-2 px-2 text-right whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10.5px] font-bold text-white ${
                              item.severity === 'critical' ? 'bg-orange-500' : 'bg-rose-500'
                            }`}
                          >
                            {item.statusLabel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                <span>বর্তমানে কোনো পেন্ডিং আবেদন বা বকেয়া সতর্কতা নেই</span>
              </div>
            )}
          </div>

          <div className="py-2.5 px-4 border-t border-rose-100 bg-rose-50/30 text-center">
            <button
              type="button"
              onClick={() => onNavigate('applications')}
              className="text-xs font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>সব আবেদন ও সতর্কতা দেখুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ROW 4: Bottom 3-Column Trends, Recent Activity & Department Workforce Bars */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
        {/* Col 1 (4 Cols): Monthly Payroll Bar Chart */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900">মাসিক বেতন ট্রেন্ড</h2>
            <button
              type="button"
              onClick={() => onNavigate('salaries')}
              className="text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              বেতন খাতা →
            </button>
          </div>

          <div className="h-44 flex items-end justify-between gap-2 pt-4 pb-1 px-1 border-b border-slate-200">
            {monthlySeries.map((m) => {
              const heightPct = m.net > 0 ? Math.max(8, Math.round((m.net / maxBarVal) * 100)) : 4;
              return (
                <div
                  key={`${m.monthName}-${m.year}`}
                  className="flex-1 flex flex-col items-center justify-end h-full group"
                  title={`${m.monthName} ${toBengaliNumber(m.year)}: ৳${formatMoney(m.net)}`}
                >
                  <div className="text-[9.5px] font-mono font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity mb-1 tabular-nums whitespace-nowrap">
                    {m.net >= 1000 ? `${Math.round(m.net / 1000)}k` : toBengaliNumber(m.net)}
                  </div>
                  <div
                    className={`w-full max-w-[30px] rounded-t-md transition-all duration-200 ${
                      m.net > 0 ? 'bg-emerald-500 group-hover:bg-emerald-600' : 'bg-slate-200'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-2 pt-2 px-1">
            {monthlySeries.map((m) => (
              <div
                key={`lbl-${m.monthName}-${m.year}`}
                className="flex-1 text-center text-[11px] font-medium text-slate-500"
              >
                {m.label}
              </div>
            ))}
          </div>
        </div>

        {/* Col 2 (4 Cols): Recent Transactions & Activity */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-900">সাম্প্রতিক লেনদেন ও কার্যক্রম</h2>
              <button
                type="button"
                onClick={() => onNavigate('salaries')}
                className="text-xs font-bold text-blue-700 hover:text-blue-900 cursor-pointer transition-colors"
              >
                সব দেখুন →
              </button>
            </div>

            {recentActivities.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {recentActivities.map((act) => {
                  const iconStyle =
                    act.tone === 'emerald'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      : act.tone === 'rose'
                      ? 'bg-rose-50 text-rose-600 border-rose-100'
                      : act.tone === 'amber'
                      ? 'bg-amber-50 text-amber-600 border-amber-100'
                      : 'bg-blue-50 text-blue-600 border-blue-100';
                  return (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => onNavigate(act.targetTab)}
                      className="w-full py-2 flex items-center justify-between gap-2 hover:bg-slate-50 rounded-lg px-1 transition-colors cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${iconStyle}`}
                        >
                          <Receipt className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[11px] font-mono font-bold text-slate-800 truncate">
                            {act.code}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{act.title}</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 tabular-nums">
                        <div className="text-xs font-mono font-bold text-slate-900">{act.amountText}</div>
                        <div className="text-[10px] text-slate-400">{act.timeText}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-slate-500">
                এখনো কোনো সাম্প্রতিক লেনদেন নেই
              </div>
            )}
          </div>
        </div>

        {/* Col 3 (4 Cols): Department-Wise Payroll & Workforce Horizontal Bars */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-900">বিভাগ অনুযায়ী মাসিক বেতন কাঠামো</h2>
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="text-xs font-bold text-blue-700 hover:text-blue-900 cursor-pointer"
              >
                বিস্তারিত →
              </button>
            </div>

            {departmentBreakdown.length > 0 ? (
              <div className="space-y-3">
                {departmentBreakdown.map((dept) => (
                  <div key={dept.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 truncate max-w-[155px]">
                        {dept.name} ({toBengaliNumber(dept.count)})
                      </span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        ৳{formatMoney(dept.totalSalary)}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-md overflow-hidden">
                      <div
                        className={`h-full rounded-md ${dept.barClass} transition-all duration-300`}
                        style={{ width: `${Math.max(8, dept.salaryRatio)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-slate-500">
                কর্মী যোগ করলে বিভাগ অনুযায়ী চার্ট দেখা যাবে
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
