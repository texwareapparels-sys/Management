import React, { useState, useEffect, useMemo } from 'react';
import { Employee, AttendanceRecord, SalaryDisbursementRecord, FactorySettings, WorkerNotice, SalaryProgressStatus, NoticeCategory, NoticePriority } from '../types';
import {
  subscribeAttendanceRecords,
  getLocalAttendanceRecords,
  subscribeSalaryRecords,
  getLocalSalaryRecords,
  getDeletedSalaryIds,
  loadFactorySettings,
  DEFAULT_FACTORY_SETTINGS,
  subscribeWorkerNotices,
  markWorkerNoticeAsRead,
  confirmWorkerNotice
} from '../lib/firebase';
import { calculateEmployeeAttendanceStats, isFriday, getBengaliDayName, getFridayBreakInfo, calculateFridayOtHours, getNewJoinerSalaryPolicy, formatTime12h, calculateCombinedPenaltyDays } from '../lib/attendanceUtils';
import { formatMoney, formatDateBn, toBengaliNumber, getStatusBadge, toEnglishNumber } from '../lib/utils';
import { printElement } from '../lib/printer';
import { WorkerProfileReadOnly } from './WorkerProfileReadOnly';
import { InstallAppModal } from './InstallAppModal';
import {
  Shirt,
  User,
  Users,
  Clock,
  Calendar,
  DollarSign,
  FileText,
  Lock,
  KeyRound,
  LogOut,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Receipt,
  Printer,
  ChevronRight,
  Eye,
  EyeOff,
  Phone,
  CreditCard,
  MapPin,
  Building2,
  ShieldAlert,
  Sparkles,
  Info,
  TrendingUp,
  BarChart3,
  Layers,
  Award,
  Bell,
  CheckCheck,
  History,
  Maximize2,
  IdCard,
  LayoutGrid,
  FileSpreadsheet,
  Smartphone,
  Download,
  ArrowLeft
} from 'lucide-react';

interface WorkerPortalProps {
  employees: Employee[];
  initialWorkerId?: string;
  initialMobile?: string;
  initialToken?: string;
  onBackToApp?: () => void;
  showToast: (msg: string) => void;
}

export const BENGALI_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

// কারখানা ও অ্যাপ চালুর শুরুর তারিখ: ১লা অক্টোবর ২০২৬
export const FACTORY_APP_START_DATE = '2026-10-01';

/**
 * স্বয়ংক্রিয় ডাইনামিক বছর জেনারেটর: বর্তমান বছরের উপর ভিত্তি করে বছর স্বয়ংক্রিয়ভাবে তৈরি হবে,
 * যাতে ভবিষ্যতে কখনোই ম্যানুয়ালি কোড আপডেট করতে না হয়।
 */
export const getDynamicYears = (startYear = 2026): number[] => {
  const currentY = new Date().getFullYear();
  const maxYear = Math.max(startYear, currentY) + 3; // পরবর্তী ৩ বছর পর্যন্ত স্বয়ংক্রিয়ভাবে তালিকায় যুক্ত থাকবে
  const years: number[] = [];
  for (let y = startYear; y <= maxYear; y++) {
    years.push(y);
  }
  return years;
};

/**
 * কারখানা ১লা অক্টোবর ২০২৬ থেকে চালু হওয়ায় ১লা অক্টোবর ২০২৬ এর পূর্ববর্তী মাস কি না তা যাচাই করার ফাংশন
 */
export const isMonthPriorToFactoryStart = (month: string, year: number): boolean => {
  if (year < 2026) return true;
  if (year === 2026) {
    const monthIndex = BENGALI_MONTHS.indexOf(month) + 1; // 1 to 12
    return monthIndex < 10; // জানুয়ারি (১) থেকে সেপ্টেম্বর (৯)
  }
  return false;
};

// সকল ১২টি মাস সর্বদা প্রদর্শিত হবে
export const getWorkerAllowedMonths = (_year?: number): string[] => {
  return BENGALI_MONTHS;
};

export const WORKER_ALLOWED_YEARS = getDynamicYears();

export const WorkerPortal: React.FC<WorkerPortalProps> = ({
  employees,
  initialWorkerId = '',
  initialMobile = '',
  initialToken = '',
  onBackToApp,
  showToast,
}) => {
  // Login Form States (Strictly Phone Number & Password Only)
  const [loginPhone, setLoginPhone] = useState<string>(() => {
    if (initialMobile) return initialMobile;
    if (initialWorkerId) {
      const match = employees.find(
        (e) => (e.workerId || '').toLowerCase() === initialWorkerId.trim().toLowerCase()
      );
      if (match && match.mobile) return match.mobile;
    }
    return '';
  });
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showInstallModal, setShowInstallModal] = useState(false);

  // Target worker identified from personal link query params or entered phone number
  const targetWorker = useMemo(() => {
    const rawMob = toEnglishNumber(initialMobile || loginPhone || '').replace(/[^0-9]/g, '');
    if (rawMob.length >= 8) {
      const found = employees.find((e) => {
        const empMob = (e.mobile || '').replace(/[^0-9]/g, '');
        return empMob && (empMob === rawMob || empMob.endsWith(rawMob) || rawMob.endsWith(empMob));
      });
      if (found) return found;
    }
    if (initialWorkerId) {
      const found = employees.find(
        (e) => (e.workerId || '').toLowerCase() === initialWorkerId.trim().toLowerCase()
      );
      if (found) return found;
    }
    return null;
  }, [employees, initialWorkerId, initialMobile, loginPhone]);

  // Logged-in Worker Session State
  const [loggedInWorker, setLoggedInWorker] = useState<Employee | null>(() => {
    try {
      const stored = localStorage.getItem('texware_worker_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        // If initialWorkerId is provided in URL and differs from stored, require login as targeted worker
        if (initialWorkerId && parsed.workerId && parsed.workerId.toLowerCase() !== initialWorkerId.toLowerCase()) {
          return null;
        }
        const match = employees.find(
          (e) => e.id === parsed.id || e.workerId === parsed.workerId || (parsed.mobile && e.mobile === parsed.mobile)
        );
        // Only active, unblocked workers with enabled portal links can restore session
        if (match && match.status === 'active' && !match.isBlocked && match.portalLinkEnabled !== false) {
          return match;
        } else if (match) {
          localStorage.removeItem('texware_worker_session');
        }
      }
    } catch {}
    return null;
  });

  // Data states
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<SalaryDisbursementRecord[]>([]);
  const [workerNotices, setWorkerNotices] = useState<WorkerNotice[]>([]);
  const [factory, setFactory] = useState<FactorySettings>(DEFAULT_FACTORY_SETTINGS);
  const [portalTab, setPortalTab] = useState<'attendance' | 'notices' | 'salary' | 'profile'>('attendance');
  const [attendanceViewMode, setAttendanceViewMode] = useState<'card' | 'table'>('card');

  // Selected Month & Year for Dashboard (Default to current calendar month & year dynamically)
  const currentDate = new Date();
  const currentY = currentDate.getFullYear();
  const currentM = currentDate.getMonth(); // 0 = Jan, 9 = Oct
  const isCurrentlyBeforeStart = currentY < 2026 || (currentY === 2026 && currentM < 9);

  const initialMonth = isCurrentlyBeforeStart ? 'অক্টোবর' : (BENGALI_MONTHS[currentM] || 'অক্টোবর');
  const initialYear = Math.max(2026, currentY);

  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);

  // Check if selected month/year is prior to factory launch (1st Oct 2026)
  const isPriorPeriod = useMemo(() => {
    return isMonthPriorToFactoryStart(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

  const handleYearChange = (newYear: number) => {
    setSelectedYear(newYear);
  };

  // Modal states
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedSlipRecord, setSelectedSlipRecord] = useState<SalaryDisbursementRecord | null>(null);

  // Subscribe to live records
  useEffect(() => {
    loadFactorySettings().then((cfg) => setFactory(cfg));

    const unsubAtt = subscribeAttendanceRecords((data) => {
      setAttendanceRecords(data);
    });

    const unsubSal = subscribeSalaryRecords((data) => {
      setSalaryRecords(data);
    });

    const unsubNotices = subscribeWorkerNotices((data) => {
      setWorkerNotices(data);
    });

    return () => {
      unsubAtt();
      unsubSal();
      unsubNotices();
    };
  }, []);

  // Update loggedInWorker when employees list updates
  useEffect(() => {
    if (loggedInWorker) {
      const updated = employees.find((e) => e.id === loggedInWorker.id);
      if (updated) {
        if (updated.status !== 'active' || updated.isBlocked || updated.portalLinkEnabled === false) {
          // Admin blocked worker, changed status, or revoked/disabled portal link in real-time
          setLoggedInWorker(null);
          localStorage.removeItem('texware_worker_session');
          if (updated.isBlocked) {
            setLoginError(
              `⛔ আপনার প্রোফাইল অ্যাডমিন কর্তৃক ব্লক করা হয়েছে!\n\nকারণ: ${
                updated.blockReason || 'প্রশাসনিক প্রয়োজনে অ্যাকাউন্ট সাময়িকভাবে বন্ধ রাখা হয়েছে।'
              }\n\nবিস্তারিত জানতে কারখানা কর্তৃপক্ষের সাথে যোগাযোগ করুন।`
            );
          } else if (updated.portalLinkEnabled === false) {
            setLoginError('⛔ আপনার প্রোফাইল লিংকটি কারখানা প্রশাসন কর্তৃক বন্ধ রাখা হয়েছে।');
          } else {
            setLoginError(
              '⚠️ আপনি বর্তমানে কারখানায় কর্মরত না থাকায় প্রোফাইল অ্যাক্সেস স্থায়ীভাবে বাতিল করা হয়েছে।'
            );
          }
        } else {
          setLoggedInWorker(updated);
        }
      }
    }
  }, [employees, loggedInWorker]);

  // Set initial login phone if provided from query params or targeted worker ID
  useEffect(() => {
    if (!loggedInWorker) {
      if (initialMobile) {
        setLoginPhone(initialMobile);
      } else if (initialWorkerId) {
        const match = employees.find(
          (e) => (e.workerId || '').toLowerCase() === initialWorkerId.trim().toLowerCase()
        );
        if (match && match.mobile) {
          setLoginPhone(match.mobile);
        }
      }
    }
  }, [initialMobile, initialWorkerId, loggedInWorker, employees]);

  // Handle Login - STRICTLY Phone Number & Password Only
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const rawInput = toEnglishNumber(loginPhone || '').trim();
    const cleanPass = toEnglishNumber(loginPassword || '').trim();
    const inputDigits = rawInput.replace(/[^0-9]/g, '');

    if (!rawInput) {
      setLoginError('অনুগ্রহ করে আপনার কারখানায় নিবন্ধিত ফোন নম্বর (Mobile Number) প্রদান করুন');
      return;
    }

    // STRICT CHECK: Reject Worker IDs or alphabetic identifiers
    const hasLetters = /[a-zA-Z]/.test(rawInput);
    if (hasLetters) {
      setLoginError('⛔ শ্রমিক আইডি বা নাম দিয়ে লগইন গ্রহণযোগ্য নয়! শুধুমাত্র আপনার কারখানায় নিবন্ধিত ফোন নম্বর এবং পাসওয়ার্ড দিয়ে লগইন করুন।');
      return;
    }

    if (inputDigits.length < 8) {
      setLoginError('⛔ সঠিক ফোন নম্বর লিখুন (কমপক্ষে ৮-১১ সংখ্যা)। শ্রমিক আইডি দিয়ে লগইন করা যাবে না।');
      return;
    }

    if (!cleanPass) {
      setLoginError('অনুগ্রহ করে পাসওয়ার্ড প্রদান করুন');
      return;
    }

    // Match employee STRICTLY by phone number
    const matchedEmp = employees.find((emp) => {
      const empMob = (emp.mobile || '').replace(/[^0-9]/g, '');
      if (!empMob) return false;
      return (
        empMob === inputDigits ||
        (inputDigits.length >= 10 && empMob.endsWith(inputDigits.slice(-10))) ||
        (empMob.length >= 10 && inputDigits.endsWith(empMob.slice(-10)))
      );
    });

    if (!matchedEmp) {
      setLoginError('এই ফোন নম্বর দিয়ে কোনো শ্রমিকের অ্যাকাউন্ট পাওয়া যায়নি। সঠিক ফোন নম্বর লিখুন অথবা কারখানা অফিসের সাথে যোগাযোগ করুন। (শ্রমিক আইডি দিয়ে লগইন করা যাবে না)');
      return;
    }

    // 0. Link status check: If admin disabled the portal link
    if (matchedEmp.portalLinkEnabled === false) {
      setLoginError(
        '⛔ এই কর্মীর প্রোফাইল পোর্টাল লিংক কারখানা প্রশাসন কর্তৃক সাময়িকভাবে বন্ধ রাখা হয়েছে।'
      );
      return;
    }

    // 0.1 Token check: If employee has a specific portalToken and link was accessed with outdated/different token
    if (initialToken && matchedEmp.portalToken && initialToken !== matchedEmp.portalToken) {
      setLoginError(
        '⛔ এই অ্যাকাউন্ট লিংকটি অ্যাডমিন কর্তৃক পরিবর্তন করা হয়েছে অথবা মেয়াদ শেষ হয়েছে! অনুগ্রহ করে কারখানা কর্তৃপক্ষ থেকে নতুন সক্রিয় লিংক গ্রহণ করুন।'
      );
      return;
    }

    // 1. Blocked worker check: Admin can block / unblock worker profile with specific reason
    if (matchedEmp.isBlocked) {
      setLoginError(
        `⛔ আপনার প্রোফাইল অ্যাডমিন কর্তৃক সাময়িকভাবে ব্লক করা হয়েছে!\n\nকারণ: ${
          matchedEmp.blockReason || 'প্রশাসনিক প্রয়োজনে অ্যাকাউন্ট বন্ধ রাখা হয়েছে।'
        }\n\nপ্রোফাইল আনব্লক করতে কারখানার অ্যাডমিন বা এইচআর শাখায় যোগাযোগ করুন।`
      );
      return;
    }

    // 2. Only actively employed workers can access the worker portal
    if (matchedEmp.status !== 'active') {
      const statusLabels: Record<string, string> = {
        resigned: 'পদত্যাগকৃত (Resigned)',
        suspended: 'সাময়িক স্থগিত (Suspended)',
        terminated: 'চাকরিচ্যুত / বরখাস্ত (Terminated)',
      };
      const label = statusLabels[matchedEmp.status] || matchedEmp.status;
      setLoginError(
        `⚠️ প্রবেশাধিকার সংরক্ষিত: আপনি বর্তমানে কারখানায় কর্মরত নন (বর্তমান অবস্থা: ${label})। শুধুমাত্র বর্তমানে কর্মরত শ্রমিকগণ তাদের প্রোফাইলে প্রবেশ করতে পারবেন।`
      );
      return;
    }

    // Check Password:
    // 1. If portalPassword is explicitly set
    // 2. Default: last 4 digits of mobile, or '123456' (NO workerId allowed as password)
    const mobileDigits = (matchedEmp.mobile || '').replace(/[^0-9]/g, '');
    const defaultLast4 = mobileDigits.slice(-4);

    const isPasswordCorrect =
      (matchedEmp.portalPassword && matchedEmp.portalPassword === cleanPass) ||
      (!matchedEmp.portalPassword && (cleanPass === defaultLast4 || cleanPass === '123456')) ||
      (cleanPass === '123456'); // Universal factory default

    if (!isPasswordCorrect) {
      setLoginError('ভুল পাসওয়ার্ড। পাসওয়ার্ড ভুলে গেলে কারখানা অ্যাডমিনের সাথে যোগাযোগ করুন।');
      return;
    }

    // Save session
    try {
      localStorage.setItem(
        'texware_worker_session',
        JSON.stringify({
          id: matchedEmp.id,
          workerId: matchedEmp.workerId,
          mobile: matchedEmp.mobile,
          name: matchedEmp.name,
        })
      );
    } catch {}

    setLoggedInWorker(matchedEmp);
    setLoginPassword('');
    showToast(`স্বাগতম, ${matchedEmp.name}! আপনার প্রোফাইলে লগইন হয়েছে।`);
  };

  // Handle Logout
  const handleLogout = () => {
    try {
      localStorage.removeItem('texware_worker_session');
    } catch {}
    setLoggedInWorker(null);
    setLoginPassword('');
    showToast('সফলভাবে লগআউট করা হয়েছে');
  };

  // Filter attendance records for this worker in selected month & year (Strictly starting from October 1st, 2026)
  const workerMonthAttendance = useMemo(() => {
    if (!loggedInWorker || isPriorPeriod) return [];
    const monthIndex = BENGALI_MONTHS.indexOf(selectedMonth) + 1;
    const monthStr = String(monthIndex).padStart(2, '0');
    const prefix = `${selectedYear}-${monthStr}`;

    return attendanceRecords
      .filter((rec) => {
        const matchEmp =
          rec.employeeId === loggedInWorker.id ||
          (rec.workerId && rec.workerId.toLowerCase() === loggedInWorker.workerId.toLowerCase());
        const matchDate = rec.date.startsWith(prefix) && rec.date >= FACTORY_APP_START_DATE;
        return matchEmp && matchDate;
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // Newest first
  }, [loggedInWorker, attendanceRecords, selectedMonth, selectedYear, isPriorPeriod]);

  // Today's Date String and Today's Live Attendance for Quick Status Glance
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayWorkerRecord = useMemo(() => {
    if (!loggedInWorker) return null;
    return attendanceRecords.find((rec) => {
      const matchEmp =
        rec.employeeId === loggedInWorker.id ||
        (rec.workerId && rec.workerId.toLowerCase() === loggedInWorker.workerId.toLowerCase()) ||
        (rec.employeeName && loggedInWorker.name && rec.employeeName.trim() === loggedInWorker.name.trim());
      return matchEmp && rec.date === todayStr && rec.date >= FACTORY_APP_START_DATE;
    });
  }, [loggedInWorker, attendanceRecords, todayStr]);

  // Calculate Attendance Stats for this worker in selected month (October 2026 onwards)
  const stats = useMemo(() => {
    if (!loggedInWorker || isPriorPeriod) {
      return {
        totalRecords: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        halfDayCount: 0,
        leaveCount: 0,
        fridayOtHours: 0,
        totalOtHours: 0,
        attendanceRate: 0,
      };
    }
    const validRecords = attendanceRecords.filter((r) => r.date >= FACTORY_APP_START_DATE);
    return calculateEmployeeAttendanceStats(
      loggedInWorker.id,
      validRecords,
      selectedMonth,
      selectedYear,
      loggedInWorker.workerId,
      loggedInWorker.name,
      loggedInWorker.joinDate
    );
  }, [loggedInWorker, selectedMonth, selectedYear, attendanceRecords, isPriorPeriod]);

  // Filter salary record for this worker in selected month (October 2026 onwards)
  const currentMonthSalary = useMemo(() => {
    if (!loggedInWorker || isPriorPeriod) return null;
    const targetEmpId = (loggedInWorker.id || '').trim();
    const targetWorkerId = (loggedInWorker.workerId || '').trim().toLowerCase();
    const targetName = (loggedInWorker.name || '').trim().toLowerCase();
    const deletedIds = getDeletedSalaryIds();

    return salaryRecords.find((rec) => {
      if (rec.id && deletedIds.has(rec.id)) return false;
      const matchMonth = rec.month === selectedMonth;
      const matchYear = Number(rec.year) === Number(selectedYear);
      if (!matchMonth || !matchYear) return false;

      const recEmpId = (rec.employeeId || '').trim();
      const recWorkerId = (rec.workerId || '').trim().toLowerCase();
      const recName = (rec.employeeName || '').trim().toLowerCase();

      return (
        (targetEmpId && recEmpId === targetEmpId) ||
        (targetWorkerId && recWorkerId === targetWorkerId) ||
        (targetName && recName === targetName)
      );
    }) || null;
  }, [loggedInWorker, salaryRecords, selectedMonth, selectedYear, isPriorPeriod]);

  // Filter notices relevant to this worker (সবার জন্য অথবা নির্দিষ্ট ব্যক্তিগত নোটিশ)
  const myNotices = useMemo(() => {
    if (!loggedInWorker) return [];
    return workerNotices.filter((n) => {
      // ডেমো নোটিশ সম্পূর্ণরূপে ফিল্টার করা
      if (n.id && n.id.startsWith('notice_default_')) return false;
      if (n.targetType === 'all') return true;
      if (n.targetEmployeeId && n.targetEmployeeId === loggedInWorker.id) return true;
      if (n.targetWorkerId && (n.targetWorkerId === loggedInWorker.workerId || n.targetWorkerId === loggedInWorker.id)) return true;
      return false;
    }).sort((a, b) => b.createdAt - a.createdAt);
  }, [workerNotices, loggedInWorker]);

  const unreadNoticesCount = useMemo(() => {
    if (!loggedInWorker) return 0;
    return myNotices.filter((n) => !n.readBy?.includes(loggedInWorker.id)).length;
  }, [myNotices, loggedInWorker]);

  // Notice filtering
  const [noticeFilter, setNoticeFilter] = useState<'all' | 'unread' | 'individual' | 'factory'>('all');

  const filteredNotices = useMemo(() => {
    return myNotices.filter((n) => {
      if (noticeFilter === 'unread') {
        return !n.readBy?.includes(loggedInWorker?.id || '');
      }
      if (noticeFilter === 'individual') {
        return n.targetType === 'individual';
      }
      if (noticeFilter === 'factory') {
        return n.targetType === 'all';
      }
      return true;
    });
  }, [myNotices, noticeFilter, loggedInWorker]);

  const getNoticeCategoryBadge = (cat?: NoticeCategory) => {
    switch (cat) {
      case 'salary': return { label: 'বেতন সংক্রান্ত', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'leave': return { label: 'ছুটি সংক্রান্ত', bg: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'overtime': return { label: 'ওভারটাইম সংক্রান্ত', bg: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
      case 'shift': return { label: 'শিফট পরিবর্তন', bg: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'discipline': return { label: 'শৃঙ্খলা ও নিয়মাবলী', bg: 'bg-rose-100 text-rose-800 border-rose-300' };
      case 'urgent': return { label: 'জরুরী বিজ্ঞপ্তি', bg: 'bg-red-100 text-red-800 border-red-300' };
      default: return { label: 'সাধারণ নোটিশ', bg: 'bg-slate-100 text-slate-800 border-slate-300' };
    }
  };

  const getNoticePriorityBadge = (p?: NoticePriority) => {
    switch (p) {
      case 'urgent': return { label: 'জরুরী', bg: 'bg-rose-600 text-white' };
      case 'important': return { label: 'গুরুত্বপূর্ণ', bg: 'bg-amber-500 text-slate-950 font-black' };
      default: return { label: 'সাধারণ', bg: 'bg-slate-200 text-slate-700' };
    }
  };

  const handleMarkNoticeAsRead = async (noticeId: string) => {
    if (!loggedInWorker) return;
    await markWorkerNoticeAsRead(noticeId, loggedInWorker.id);
    showToast('নোটিশটি পঠিত হিসেবে চিহ্নিত হয়েছে');
  };

  const handleConfirmNotice = async (noticeId: string) => {
    if (!loggedInWorker) return;
    await confirmWorkerNotice(noticeId, {
      id: loggedInWorker.id,
      workerId: loggedInWorker.workerId,
      name: loggedInWorker.name,
    });
    showToast('✓ নোটিশটি নিশ্চিত করা হয়েছে। কারখানা অ্যাডমিন আপনার নিশ্চিতকরণ দেখতে পারছেন।');
  };

  // Previous salary records history for this worker
  const workerSalaryHistory = useMemo(() => {
    if (!loggedInWorker) return [];
    const targetEmpId = (loggedInWorker.id || '').trim();
    const targetWorkerId = (loggedInWorker.workerId || '').trim().toLowerCase();
    const targetName = (loggedInWorker.name || '').trim().toLowerCase();
    const deletedIds = getDeletedSalaryIds();

    return salaryRecords
      .filter((rec) => {
        if (rec.id && deletedIds.has(rec.id)) return false;
        const recEmpId = (rec.employeeId || '').trim();
        const recWorkerId = (rec.workerId || '').trim().toLowerCase();
        const recName = (rec.employeeName || '').trim().toLowerCase();
        return (
          (targetEmpId && recEmpId === targetEmpId) ||
          (targetWorkerId && recWorkerId === targetWorkerId) ||
          (targetName && recName === targetName)
        );
      })
      .sort((a, b) => (b.paidAt || b.statusUpdatedAt || 0) - (a.paidAt || a.statusUpdatedAt || 0));
  }, [loggedInWorker, salaryRecords]);

  // Salary Progress Status Helper
  const getSalaryProgressInfo = (status?: SalaryProgressStatus, paymentStatus?: string) => {
    if (status === 'disbursed' || paymentStatus === 'paid') {
      return {
        label: 'বেতন প্রদান করা সম্পূর্ণ',
        step: 4,
        badge: 'bg-teal-100 text-teal-800 border-teal-300',
        activeColor: 'bg-teal-600 text-white',
        desc: 'আপনার অ্যাকাউন্টে বা হাতে বেতন প্রদান সফলভাবে সম্পন্ন হয়েছে।',
      };
    }
    if (status === 'ready') {
      return {
        label: 'বেতন দেওয়ার জন্য প্রস্তুত',
        step: 3,
        badge: 'bg-purple-100 text-purple-800 border-purple-300',
        activeColor: 'bg-purple-600 text-white',
        desc: 'হিসাব সম্পন্ন ও অনুমোদন হয়েছে, যেকোনো সময় বেতন প্রদান করা হবে।',
      };
    }
    if (status === 'calculated') {
      return {
        label: 'হিসাব সম্পূর্ণ',
        step: 2,
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        activeColor: 'bg-emerald-600 text-white',
        desc: 'অ্যাডমিন কর্তৃক আপনার মাসিক হাজিরা, ওভারটাইম ও নিট বেতন হিসাব সম্পন্ন হয়েছে।',
      };
    }
    return {
      label: 'বাকী',
      step: 1,
      badge: 'bg-rose-100 text-rose-800 border-rose-300',
      activeColor: 'bg-rose-600 text-white',
      desc: 'এই মাসের বেতন হিসাব ও পরিশোধ এখনও বাকী রয়েছে।',
    };
  };

  // Salary Progress Status Info (তারিখ অনুযায়ী বেতনের অবস্থান)
  const progressInfo = useMemo(() => {
    if (isPriorPeriod) {
      return {
        step: 0,
        label: 'কারখানা চালুর পূর্ববর্তী মাস',
        badge: 'bg-slate-100 text-slate-600 border-slate-300',
        activeColor: 'bg-slate-400 text-white',
        desc: '১লা অক্টোবর ২০২৬ এর পূর্বে এই কারখানা ও অ্যাপের কার্যক্রম চালু ছিল না।'
      };
    }
    return getSalaryProgressInfo(currentMonthSalary?.progressStatus, currentMonthSalary?.paymentStatus);
  }, [currentMonthSalary, isPriorPeriod]);

  const joinPolicy = useMemo(() => {
    return getNewJoinerSalaryPolicy(loggedInWorker?.joinDate, selectedMonth, selectedYear);
  }, [loggedInWorker?.joinDate, selectedMonth, selectedYear]);

  // Combined Penalty Days: প্রতি ৩ দিন লেট বা অনুপস্থিতির জন্য ১ দিন হাজিরা কর্তন
  const penaltyInfo = useMemo(() => {
    return calculateCombinedPenaltyDays(
      currentMonthSalary?.absentDays ?? stats.absentCount,
      currentMonthSalary?.lateDays ?? stats.lateCount,
      joinPolicy.isNewJoinerMidMonth
    );
  }, [currentMonthSalary, stats.absentCount, stats.lateCount, joinPolicy.isNewJoinerMidMonth]);

  const effectivePresentDays = useMemo(() => {
    if (currentMonthSalary?.effectivePresentDays !== undefined) {
      return currentMonthSalary.effectivePresentDays;
    }
    return Math.max(0, stats.presentCount - penaltyInfo.totalPenaltyDays);
  }, [currentMonthSalary, stats.presentCount, penaltyInfo.totalPenaltyDays]);

  // Auto bonus rule: অনুপস্থিত বা লেট থাকলে কোনো হাজিরা বোনাস পাবে না (০ টাকা), নতুন কর্মীর খণ্ডিত মাসে বোনাস নেই
  const autoBonusAmount = (isPriorPeriod || joinPolicy.isNewJoinerMidMonth || stats.absentCount > 0 || stats.lateCount > 0) ? 0 : 500;
  const estimatedPayable = isPriorPeriod ? 0 : (currentMonthSalary?.netPayable ??
    Math.round(
      (((Number(loggedInWorker?.salary) || 0) / 26) * effectivePresentDays) +
      ((stats.totalOtHours || 0) * (Number(loggedInWorker?.otRate) || 0)) +
      autoBonusAmount
    ));

  // Print Salary Slip
  const handlePrintSlip = () => {
    const el = document.getElementById('workerPortalSlipArea');
    if (el) {
      printElement(el, `PaySlip-${loggedInWorker?.workerId}-${selectedMonth}`, 'pos');
      showToast('পে-স্লিপ প্রিন্ট সম্পন্ন হয়েছে');
    }
  };

  /* ================= LOGIN VIEW (IF NOT LOGGED IN) ================= */
  if (!loggedInWorker) {
    return (
      <div className="max-w-md mx-auto my-6 p-4">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Top Brand Banner */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-900 text-white p-6 text-center relative overflow-hidden">
            {onBackToApp && (
              <button
                type="button"
                onClick={onBackToApp}
                title="আগের পেজে ফিরে যান"
                className="absolute left-3.5 top-3.5 z-10 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>ফিরে যান</span>
              </button>
            )}
            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
            <div className="w-18 h-18 rounded-3xl bg-white p-1 border-2 border-white/30 flex items-center justify-center mx-auto mb-3 shadow-lg overflow-hidden">
              <img src="/logo.png" alt="টেক্স ওয়ার লোগো" className="w-full h-full object-contain rounded-2xl" />
            </div>

            {targetWorker ? (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-[11px] font-bold text-emerald-200 shadow-inner">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>ব্যক্তিগত প্রোফাইল পোর্টাল লিংক</span>
                </div>
                <h2 className="text-xl font-black tracking-tight text-white mt-1">
                  স্বাগতম, {targetWorker.name}!
                </h2>
                <div className="flex items-center justify-center gap-2 flex-wrap text-xs text-blue-200">
                  <span>Worker ID: <b className="font-mono text-white bg-white/20 px-2 py-0.5 rounded-md">{targetWorker.workerId}</b></span>
                  <span>•</span>
                  <span>{targetWorker.designation}</span>
                  {targetWorker.department && <span>({targetWorker.department})</span>}
                </div>
                <p className="text-[11px] text-slate-300 mt-2 max-w-xs mx-auto">
                  এটি আপনার জন্য তৈরিকৃত আলাদা ব্যক্তিগত পোর্টাল লিংক। আপনার পাসওয়ার্ড দিয়ে প্রবেশ করুন।
                </p>
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-black tracking-tight text-white">টেক্স ওয়ার শ্রমিক অ্যাপ</h2>
                <p className="text-xs text-teal-200 font-bold mt-1">শ্রমিকদের নিজস্ব হাজিরা ও বেতন দেখার মোবাইল অ্যাপ</p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/25 border border-teal-400/40 text-[11px] font-bold text-teal-100 mt-2 shadow-inner">
                  <span>📱 শ্রমিকদের জন্য স্বতন্ত্র আলাদা অ্যাপ</span>
                </div>
                <p className="text-[11px] text-slate-300 mt-2 max-w-xs mx-auto">
                  আপনার কারখানায় নিবন্ধিত ফোন নম্বর এবং পাসওয়ার্ড দিয়ে লগইন করে নিজের দৈনন্দিন হাজিরা, ওটি ও বেতন বিবরণী দেখুন।
                </p>
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="p-6 space-y-4">
            {/* Early status warnings for targeted worker */}
            {targetWorker && targetWorker.portalLinkEnabled === false && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-950 flex items-start gap-2 shadow-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <b className="block">লিংকটি সাময়িকভাবে বন্ধ রয়েছে:</b>
                  <span>কারখানা প্রশাসন কর্তৃক এই ব্যক্তিগত লিংকটি সাময়িকভাবে বন্ধ রাখা হয়েছে। পুনরায় চালুর জন্য অ্যাডমিনের সাথে যোগাযোগ করুন।</span>
                </div>
              </div>
            )}

            {targetWorker && initialToken && targetWorker.portalToken && initialToken !== targetWorker.portalToken && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-2xl text-xs text-rose-950 flex items-start gap-2 shadow-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <b className="block">পুরাতন বা পরিবর্তিত লিংক:</b>
                  <span>এই লিংকটি পরিবর্তন করা হয়েছে বা পুরাতন হয়ে গেছে। কারখানা অ্যাডমিন থেকে আপনার নতুন সক্রিয় ব্যক্তিগত লিংক সংগ্রহ করুন।</span>
                </div>
              </div>
            )}

            {loginError && (
              <div className={`p-3.5 border rounded-2xl text-xs flex flex-col gap-2 animate-in fade-in duration-200 ${
                loginError.includes('ব্লক') || loginError.includes('সংরক্ষিত')
                  ? 'bg-rose-50 border-rose-300 text-rose-950 shadow-xs'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
                  <div className="font-semibold whitespace-pre-line leading-relaxed flex-1">
                    {loginError}
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-teal-700" />
                  <span>ফোন নম্বর (Mobile Number) *</span>
                </label>
                {targetWorker && (
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200">
                    ✓ {targetWorker.name}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="tel"
                  required
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  placeholder="১১ সংখ্যার ফোন নম্বর লিখুন (যেমন: 017xxxxxxxx)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-600 outline-none transition"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {targetWorker && targetWorker.mobile
                  ? `✓ শনাক্তকৃত কর্মী: ${targetWorker.name} (মোবাইল: ${targetWorker.mobile})`
                  : 'শুধুমাত্র কারখানায় নিবন্ধিত ফোন নম্বর এবং পাসওয়ার্ড দিয়ে লগইন করা যাবে (শ্রমিক আইডি প্রযোজ্য নয়)'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                পাসওয়ার্ড (Password) *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="পাসওয়ার্ড লিখুন"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-600 outline-none transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                ডিফল্ট পাসওয়ার্ড: মোবাইলের শেষ ৪ সংখ্যা অথবা 123456
              </span>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition active:scale-95"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>প্রোফাইলে লগইন করুন</span>
            </button>

            {/* Mobile PWA Download & Install Guide Button */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowInstallModal(true)}
                className="w-full py-3 px-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition active:scale-95 cursor-pointer border border-emerald-300/30"
              >
                <Download className="w-4 h-4 text-amber-300" />
                <span>📱 টেক্স ওয়ার শ্রমিক অ্যাপ ফোনে ডাউনলোড ও ইনস্টল করুন</span>
              </button>
            </div>

            <div className="text-center text-xs text-slate-500 space-y-1">
              <p className="text-[11px] text-slate-600 font-medium">
                পাসওয়ার্ড পরিবর্তন বা সহায়তা প্রয়োজন হলে কারখানার এইচআর বা অ্যাডমিন শাখায় যোগাযোগ করুন।
              </p>
              <p className="text-[10px] text-slate-400">
                সুরক্ষিত একক কর্মী পোর্টাল • অননুমোদিত অ্যাক্সেস সংরক্ষিত
              </p>
            </div>
          </form>

          {/* Phone App Install Modal */}
          <InstallAppModal
            isOpen={showInstallModal}
            onClose={() => setShowInstallModal(false)}
            appName="টেক্স ওয়ার শ্রমিক অ্যাপ"
            appSubtitle="শ্রমিকদের নিজস্ব হাজিরা ও বেতন বিবরণী দেখার মোবাইল অ্যাপ"
            mode="worker"
          />
        </div>
      </div>
    );
  }

  /* ================= WORKER LOGGED IN DASHBOARD (READ-ONLY) ================= */
  const statusInfo = getStatusBadge(loggedInWorker.status);

  return (
    <div className="space-y-4">
      {/* 1. Worker Profile Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden border border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          {/* Worker Info */}
          <div className="flex items-center gap-3.5">
            <div
              onClick={() => setShowPhotoModal(true)}
              className="w-16 h-20 sm:w-20 sm:h-24 rounded-2xl bg-slate-800 border-2 border-blue-400/40 overflow-hidden shrink-0 flex items-center justify-center shadow-inner relative group cursor-pointer hover:border-amber-400 transition"
              title="ছবি বড় করে ও পূর্ণাঙ্গ পরিচয়পত্র দেখতে চাপুন"
            >
              {loggedInWorker.photoUrl ? (
                <img
                  src={loggedInWorker.photoUrl}
                  alt={loggedInWorker.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition"
                />
              ) : (
                <User className="w-8 h-8 text-blue-300" />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
                <Maximize2 className="w-4 h-4 text-white" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-white">{loggedInWorker.name}</h2>
                <span className="font-mono font-black text-xs px-2.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30">
                  {loggedInWorker.workerId}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusInfo.bg}`}>
                  {statusInfo.label}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                <span>পদ: <b>{loggedInWorker.designation}</b></span>
                <span>•</span>
                <span>সেকশন: <b>{loggedInWorker.department || 'সুইং'}</b></span>
                {loggedInWorker.joinDate && (
                  <>
                    <span>•</span>
                    <span>যোগদান: <b>{formatDateBn(loggedInWorker.joinDate)}</b></span>
                  </>
                )}
              </p>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-300">
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3 h-3 text-slate-400" />
                  {loggedInWorker.mobile || '—'}
                </span>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setPortalTab('profile')}
                  className="text-amber-300 hover:text-amber-200 font-semibold underline decoration-dotted cursor-pointer flex items-center gap-1"
                >
                  <User className="w-3 h-3" />
                  <span>একনজরে পূর্ণাঙ্গ প্রোফাইল তথ্য (রিড-অনলি)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            {/* ছবি ও পূর্ণাঙ্গ আইডি কার্ড বাটন */}
            <button
              type="button"
              onClick={() => setShowPhotoModal(true)}
              className="px-3 py-1.5 rounded-xl bg-blue-600/80 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
              title="শ্রমিকের ছবি বড় করে ও পূর্ণাঙ্গ পরিচয়পত্র দেখুন"
            >
              <IdCard className="w-3.5 h-3.5" />
              <span>ছবি ও পরিচয়পত্র</span>
            </button>

            {/* নোটিশ বোর্ড বাটন */}
            <button
              type="button"
              onClick={() => setPortalTab(portalTab === 'notices' ? 'attendance' : 'notices')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer relative ${
                portalTab === 'notices'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-500/25 hover:bg-purple-500/40 text-purple-200 border border-purple-400/30'
              }`}
              title="নোটিশ বোর্ড দেখুন"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>নোটিশ বোর্ড</span>
              {myNotices.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 ml-0.5">
                  {myNotices.length}
                </span>
              )}
            </button>

            {/* বেতনের অবস্থান বাটন */}
            <button
              type="button"
              onClick={() => setPortalTab(portalTab === 'salary' ? 'attendance' : 'salary')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer ${
                portalTab === 'salary'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-200 border border-emerald-400/30'
              }`}
              title="বেতনের বর্তমান অবস্থান ও ইতিহাস দেখুন"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>বেতন অবস্থান</span>
            </button>

            {/* প্রোফাইল তথ্য বাটন (রিড-অনলি) */}
            <button
              type="button"
              onClick={() => setPortalTab(portalTab === 'profile' ? 'attendance' : 'profile')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer ${
                portalTab === 'profile'
                  ? 'bg-amber-400 text-slate-950 font-black'
                  : 'bg-amber-500/25 hover:bg-amber-500/40 text-amber-200 border border-amber-400/30'
              }`}
              title="আপনার সকল ব্যক্তিগত ও কর্মসংস্থান তথ্য একনজরে দেখুন"
            >
              <User className="w-3.5 h-3.5" />
              <span>প্রোফাইল তথ্য</span>
            </button>

            {/* ফোনে শ্রমিক অ্যাপ ডাউনলোড ও ইনস্টল বাটন */}
            <button
              type="button"
              onClick={() => setShowInstallModal(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-100 border border-emerald-400/35 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
              title="শ্রমিক অ্যাপটি ফোনে ইনস্টল বা ডাউনলোড করার নিয়ম"
            >
              <img src="/logo.png" alt="Logo" className="w-4 h-4 object-contain rounded-full bg-white p-0.5" />
              <span>📱 শ্রমিক অ্যাপ ডাউনলোড</span>
            </button>

            {onBackToApp && (
              <button
                type="button"
                onClick={onBackToApp}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                title="আগের পেজে ফিরে যান"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>ফিরে যান</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-600 text-slate-200 hover:text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>লগআউট</span>
            </button>
          </div>
        </div>

        {/* Read-Only Notice Bar */}
        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2 text-[11px] text-slate-300">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-300 shrink-0" />
            <span>
              আপনার প্রোফাইলের সকল তথ্য, হাজিরা ও ওটি কারখানা সার্ভার থেকে সরাসরি প্রদর্শিত হচ্ছে। কোনো গরমিল থাকলে এইচআর অ্যাডমিনকে জানান।
            </span>
          </div>
        </div>
      </div>

      {/* 1.1 Worker Portal Navigation Tabs Bar */}
      <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex-wrap">
        <button
          type="button"
          onClick={() => setPortalTab('attendance')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 ${
            portalTab === 'attendance'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>হাজিরা ও ওটি বিশ্লেষণ</span>
        </button>

        <button
          type="button"
          onClick={() => setPortalTab('notices')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 relative ${
            portalTab === 'notices'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>নোটিশ বোর্ড</span>
          {myNotices.length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              portalTab === 'notices' ? 'bg-white text-purple-900' : 'bg-purple-100 text-purple-800'
            }`}>
              {myNotices.length}
            </span>
          )}
          {unreadNoticesCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 ml-1" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setPortalTab('salary')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 ${
            portalTab === 'salary'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>বেতনের অবস্থান ও হিস্ট্রি</span>
        </button>

        <button
          type="button"
          onClick={() => setPortalTab('profile')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 ${
            portalTab === 'profile'
              ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <User className="w-4 h-4" />
          <span>আমার প্রোফাইল তথ্য</span>
        </button>
      </div>

      {/* Quick Unread Notice Alert Banner */}
      {unreadNoticesCount > 0 && portalTab !== 'notices' && (
        <div
          onClick={() => setPortalTab('notices')}
          className="p-3 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-2xl border border-purple-400/40 flex items-center justify-between gap-2 shadow-sm cursor-pointer hover:opacity-95 transition"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/30 border border-purple-400/40 flex items-center justify-center text-purple-200 shrink-0">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <p className="text-xs font-black text-purple-200">
                নোটিশ বোর্ড: আপনার জন্য {toBengaliNumber(unreadNoticesCount)}টি নতুন নোটিশ রয়েছে!
              </p>
              <p className="text-[11px] text-slate-300">
                {myNotices[0]?.title} • বিস্তারিত দেখতে এখানে চাপুন
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-purple-500 text-white font-bold text-xs shrink-0">
            দেখুন →
          </span>
        </div>
      )}

      {/* ================= 1. ATTENDANCE & OVERTIME TAB ================= */}
      {portalTab === 'attendance' && (
        <div className="space-y-4">
          {/* Today's Live Attendance Status Glance */}
          {todayWorkerRecord ? (
            <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white rounded-2xl p-4 shadow-sm border border-emerald-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white">আজকের উপস্থিতি রেকর্ড</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
                      {todayWorkerRecord.status === 'present' ? 'উপস্থিত' : todayWorkerRecord.status === 'late' ? 'বিলম্ব / লেট' : todayWorkerRecord.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-200/90 mt-0.5">
                    আজ: {formatDateBn(todayStr)} ({getBengaliDayName(todayStr)}) • ইন-টাইম: {todayWorkerRecord.inTime ? formatTime12h(todayWorkerRecord.inTime) : '—'} • আউট: {todayWorkerRecord.outTime ? formatTime12h(todayWorkerRecord.outTime) : 'চলমান'}
                  </p>
                </div>
              </div>
              {Number(todayWorkerRecord.otHours) > 0 && (
                <div className="px-3 py-1.5 rounded-xl bg-indigo-500/30 border border-indigo-400/30 text-right self-start sm:self-auto">
                  <span className="text-[10px] text-indigo-200 block font-semibold">আজকের ওটি</span>
                  <span className="text-sm font-black text-indigo-100 font-mono">{toBengaliNumber(todayWorkerRecord.otHours || 0)} ঘণ্টা</span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 block">আজকের উপস্থিতি ({formatDateBn(todayStr)})</span>
                  <span className="text-[11px] text-slate-500">কারখানা সার্ভারে আজকের হাজিরার এন্ট্রি এখনও অপেক্ষমাণ রয়েছে</span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                অপেক্ষমাণ
              </span>
            </div>
          )}

          {/* 2. Month & Year Selector Bar */}
          <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span className="font-bold text-xs text-slate-800">মাসের হাজিরা ও বেতন বিবরণী:</span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-xl bg-slate-50 font-bold text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
          >
            {BENGALI_MONTHS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            className="px-3 py-1.5 border border-slate-300 rounded-xl bg-slate-50 font-mono font-bold text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
          >
            {getDynamicYears().map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Prior period info banner if month is before October 2026 */}
      {isPriorPeriod && (
        <div className="bg-amber-50 border border-amber-300/80 rounded-2xl p-3.5 text-xs text-amber-950 flex items-start gap-2.5 shadow-xs animate-in fade-in">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-950 block">
              কারখানা চালুর পূর্ববর্তী সময়কাল ({selectedMonth} {selectedYear})
            </span>
            <span className="text-amber-800 text-[11px] mt-0.5 block leading-relaxed">
              টেক্স ওয়ার অ্যাপারেলসের সকল ডিজিটাল কার্যক্রম ও কর্মী হাজিরা হিসাব <b>১লা অক্টোবর ২০২৬</b> তারিখ থেকে শুরু হয়েছে। তাই এই মাসের কোনো হাজিরা বা ওটি রেকর্ড প্রযোজ্য নয়।
            </span>
          </div>
        </div>
      )}

      {/* 3. Monthly Vital Metric Cards (৫টি প্রধান সূচক) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {/* Present Days (Regular Workdays only - Friday excluded) */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>নিয়মিত উপস্থিতি</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-1">
            <span>{toBengaliNumber(stats.presentCount)}</span>
            <span className="text-xs font-normal text-slate-500">দিন</span>
          </div>
          <div className="text-[10px] text-emerald-700 font-bold mt-0.5 truncate">
            শুক্রবার বাদে নিয়মিত কর্মদিবস ({toBengaliNumber(stats.attendanceRate)}%)
          </div>
        </div>

        {/* Missed / Absent Days */}
        <div className="bg-white p-3 rounded-2xl border border-rose-200 shadow-xs bg-rose-50/20">
          <div className="flex items-center justify-between text-xs text-rose-700 font-semibold">
            <span>অনুপস্থিত / মিস দিন</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700 mt-1 flex items-baseline gap-1">
            <span>{toBengaliNumber(stats.absentCount)}</span>
            <span className="text-xs font-normal text-slate-500">দিন</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 truncate">
            {stats.lateCount > 0 ? `লেট: ${toBengaliNumber(stats.lateCount)} দিন` : 'শুক্রবার ছুটি ধরা হয়নি'}
          </div>
        </div>

        {/* Total Overtime (OT) Hours */}
        <div className="bg-white p-3 rounded-2xl border border-indigo-200 shadow-xs bg-indigo-50/20">
          <div className="flex items-center justify-between text-xs text-indigo-700 font-semibold">
            <span>সর্বমোট ওটি (OT)</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-900 mt-1 flex items-baseline gap-1">
            <span>{toBengaliNumber(stats.totalOtHours)}</span>
            <span className="text-xs font-normal text-slate-500">ঘণ্টা</span>
          </div>
          <div className="text-[10px] text-indigo-600 font-bold mt-0.5 truncate">
            নিয়মিত: {toBengaliNumber(stats.regularOtHours || 0)}ঘ. + শুক্র: {toBengaliNumber(stats.fridayOtHours || 0)}ঘ.
          </div>
        </div>

        {/* Friday Special OT Card */}
        <div className="bg-white p-3 rounded-2xl border border-amber-200 shadow-xs bg-amber-50/30">
          <div className="flex items-center justify-between text-xs text-amber-800 font-semibold">
            <span>শুক্রবার বিশেষ ওটি</span>
            <Sparkles className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1 flex items-baseline gap-1">
            <span>{toBengaliNumber(stats.fridayOtHours || 0)}</span>
            <span className="text-xs font-normal text-slate-500">ঘণ্টা</span>
          </div>
          <div className="text-[10px] text-amber-700 font-bold mt-0.5 truncate">
            {(stats.fridayDutiesCount ?? 0) > 0
              ? `ডিউটি: ${toBengaliNumber(stats.fridayDutiesCount || 0)} দিন (হাজিরা ০, শুধু ওটি)`
              : 'কোনো শুক্রবারে ওটি নেই'}
          </div>
        </div>

        {/* Estimated / Final Salary */}
        <div className="bg-white p-3 rounded-2xl border border-emerald-200 shadow-xs bg-emerald-50/20 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>প্রদেয় মোট বেতন</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-800 mt-1 flex items-baseline gap-1">
            <span>
              ৳ {formatMoney(currentMonthSalary?.netPayable ?? estimatedPayable)}
            </span>
          </div>
          <div className="text-[10px] font-bold mt-0.5">
            {currentMonthSalary ? (
              <span className={currentMonthSalary.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-amber-700'}>
                {currentMonthSalary.paymentStatus === 'paid' ? 'পরিশোধিত (Paid)' : 'বকেয়া / চূড়ান্তকৃত'}
              </span>
            ) : (
              <span className="text-blue-700">চলতি সম্ভাব্য হিসাব</span>
            )}
          </div>
        </div>
      </div>

      {/* 4. COMPREHENSIVE ANALYTICS & AUDIT BREAKDOWN (সকল হিসাব আরো বিশ্লেষণ সহ) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-black text-sm text-slate-900">
                {selectedMonth} {selectedYear} — বিস্তারিত হাজিরা, ওটি ও বেতন বিশ্লেষণ
              </h3>
              <p className="text-xs text-slate-500">
                হাজিরা খাতা, শুক্রবারের ওটি পলিসি ও বেতন নীতি অনুযায়ী সম্পূর্ণ বিশ্লেষণ
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs flex items-center gap-1 self-start sm:self-auto">
            <Layers className="w-3.5 h-3.5" />
            <span>পূর্ণাঙ্গ অডিট বিবরণী</span>
          </span>
        </div>

        {/* ৩টি বিস্তারিত বিশ্লেষণ কার্ড */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Card 1: হাজিরা ও কর্মদিবস বিশ্লেষণ */}
          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200 space-y-2.5">
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 pb-1 border-b border-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>১. হাজিরা ও ছুটির বিশ্লেষণ</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-slate-700 bg-slate-100/70 p-1.5 rounded-lg font-bold">
                <span>কারখানার মোট অফিস ডে:</span>
                <span className="font-black text-slate-900 font-mono">
                  {toBengaliNumber(stats.totalOfficeDays || 26)} দিন
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>নিয়মিত উপস্থিত দিন:</span>
                <span className="font-black text-slate-900 font-mono">
                  {toBengaliNumber(stats.presentCount)} দিন
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>অনুপস্থিত / মিস দিন:</span>
                <span className={`font-black font-mono ${stats.absentCount > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                  {toBengaliNumber(stats.absentCount)} দিন
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>বিলম্ব / লেট দিন:</span>
                <span className="font-bold text-amber-700 font-mono">
                  {toBengaliNumber(stats.lateCount)} দিন
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>অনুমোদিত ছুটি (Leave):</span>
                <span className="font-bold text-blue-700 font-mono">
                  {toBengaliNumber(stats.leaveCount || 0)} দিন
                </span>
              </div>
              <div className="flex justify-between items-center text-amber-900 bg-amber-100/60 p-1.5 rounded-lg border border-amber-200 font-semibold text-[11px]">
                <span>শুক্রবার ওটি ডিউটি:</span>
                <span className="font-black text-amber-950 font-mono">
                  {toBengaliNumber(stats.fridayDutiesCount || 0)} দিন (হাজিরা ০)
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: ওভারটাইম (OT) ও কর্মঘণ্টা বিশ্লেষণ */}
          <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-2.5">
            <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-950 pb-1 border-b border-indigo-200">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>২. ওভারটাইম (OT) বিশ্লেষণ</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-slate-700">
                <span>সাধারণ দিনের ওটি:</span>
                <span className="font-black text-slate-900 font-mono">
                  {toBengaliNumber(stats.regularOtHours || 0)} ঘণ্টা
                </span>
              </div>
              <div className="flex justify-between items-center text-indigo-900">
                <span>শুক্রবার বিশেষ ওটি:</span>
                <span className="font-black text-indigo-950 font-mono">
                  {toBengaliNumber(stats.fridayOtHours || 0)} ঘণ্টা
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span>প্রতি ঘণ্টার ওটি রেট:</span>
                <span className="font-bold text-slate-900 font-mono">
                  ৳ {formatMoney(loggedInWorker.otRate)}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span>নিয়মিত ওটি আয়:</span>
                <span className="font-bold text-slate-900 font-mono">
                  ৳ {formatMoney(Math.round((stats.regularOtHours || 0) * (Number(loggedInWorker.otRate) || 0)))}
                </span>
              </div>
              <div className="flex justify-between items-center text-indigo-900 bg-indigo-100/70 p-1.5 rounded-lg border border-indigo-200 font-bold text-[11px]">
                <span>মোট ওটি উপার্জন:</span>
                <span className="font-black text-indigo-950 font-mono">
                  ৳ {formatMoney(Math.round((stats.totalOtHours || 0) * (Number(loggedInWorker.otRate) || 0)))}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: বেতন হিসাব ও মজুরি বিশ্লেষণ */}
          <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-2.5">
            <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-950 pb-1 border-b border-emerald-200">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>৩. বেতন হিসাব ও আর্থিক বিশ্লেষণ</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-slate-700">
                <span>মূল মাসিক বেতন (Basic):</span>
                <span className="font-black text-slate-900 font-mono">
                  ৳ {formatMoney(loggedInWorker.salary)}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span>দৈনিক মূল হার (Basic ÷ ২৬):</span>
                <span className="font-bold text-slate-900 font-mono">
                  ৳ {formatMoney(Math.round((Number(loggedInWorker.salary) || 0) / 26))}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span>উপস্থিতির মজুরি ({toBengaliNumber(effectivePresentDays)} দিন):</span>
                <span className="font-bold text-slate-900 font-mono">
                  ৳ {formatMoney(Math.round(((Number(loggedInWorker.salary) || 0) / 26) * effectivePresentDays))}
                </span>
              </div>
              {penaltyInfo.totalPenaltyDays > 0 && (
                <div className="flex justify-between items-center text-rose-700 bg-rose-50/70 p-1.5 rounded-lg border border-rose-200 font-semibold text-[11px]">
                  <span>লেট ও অনুপস্থিতি কর্তন (৩ দিনে ১ দিন):</span>
                  <span className="font-bold font-mono">
                    -{toBengaliNumber(penaltyInfo.totalPenaltyDays)} দিন
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center text-slate-700">
                <span>ওভারটাইম টাকা ({toBengaliNumber(stats.totalOtHours)} ঘ.):</span>
                <span className="font-bold text-indigo-900 font-mono">
                  ৳ {formatMoney(Math.round((stats.totalOtHours || 0) * (Number(loggedInWorker.otRate) || 0)))}
                </span>
              </div>
              <div className="flex justify-between items-center text-emerald-900 bg-emerald-100/70 p-1.5 rounded-lg border border-emerald-200 font-bold text-[11px]">
                <span>সর্বমোট প্রদেয় বেতন:</span>
                <span className="font-black text-emerald-950 font-mono text-xs">
                  ৳ {formatMoney(currentMonthSalary?.netPayable ?? estimatedPayable)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Friday Special Policy Clarification Banner */}
        <div className="p-3 bg-gradient-to-r from-amber-50 via-amber-100/50 to-orange-50 rounded-xl border border-amber-300 text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-black text-amber-950">
              কারখানা বিধি (শুক্রবার ওটি সংক্রান্ত নিয়মাবলী):
            </span>
            <p className="text-amber-900 text-[11px] leading-relaxed">
              ১. প্রতি <b>শুক্রবার কারখানার সাপ্তাহিক ছুটি</b>। শুক্রবারে কাজ করলে কোনো সাধারণ দৈনিক হাজিরা (উপস্থিতি দিন) যোগ হয় না, সম্পূর্ণ কাজের সময় <b>শুধুমাত্র ওভারটাইম (OT)</b> হিসেবে গণনা করা হয়।<br />
              ২. শুক্রবারে ডিউটি করলে দুপুর <b>১:০০টা থেকে ২:০০টা পর্যন্ত ১ ঘণ্টা</b> জুমার নামাজ ও দুপুরের খাবারের বিরতি স্বয়ংক্রিয়ভাবে ওটি থেকে বাদ দেওয়া হয়।
            </p>
          </div>
        </div>
      </div>

      {/* 5. Finalized Salary Slip View (If finalized in admin) */}
      {currentMonthSalary && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-emerald-200 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-900">
                {selectedMonth} {selectedYear} এর চূড়ান্ত বেতন রসিদ ও পে-স্লিপ
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                currentMonthSalary.paymentStatus === 'paid'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {currentMonthSalary.paymentStatus === 'paid' ? 'পরিশোধিত (Paid)' : 'বকেয়া'}
              </span>
              <button
                type="button"
                onClick={() => setSelectedSlipRecord(currentMonthSalary)}
                className="px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>পে-স্লিপ প্রিন্ট দেখুন</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block">উপস্থিত বেতন:</span>
              <span className="font-black text-slate-900 text-sm">৳ {formatMoney(currentMonthSalary.presentSalary)}</span>
            </div>
            <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-200">
              <span className="text-indigo-700 block">ওভারটাইম টাকা ({toBengaliNumber(currentMonthSalary.otHours)} ঘ.):</span>
              <span className="font-black text-indigo-900 text-sm">৳ {formatMoney(currentMonthSalary.otPay)}</span>
            </div>
            <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-200">
              <span className="text-emerald-700 block">মোট প্রদেয় বেতন (Net):</span>
              <span className="font-black text-emerald-800 text-sm">৳ {formatMoney(currentMonthSalary.netPayable)}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block">পরিশোধের মাধ্যম:</span>
              <span className="font-bold text-slate-800 text-sm capitalize">
                {currentMonthSalary.paymentMethod === 'cash' ? 'ক্যাশ' : currentMonthSalary.paymentMethod}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 6. Daily Attendance & In/Out Times Log (দৈনিক ইন-আউট টাইম ও ওটি খাতা) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>দৈনিক ইন-টাইম, আউট-টাইম ও ওটি হিসাবের খাতা</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedMonth} {selectedYear} মাসের প্রতিটি দিনের বিস্তারিত ইন-আউট সময়, ওটি ও শুক্রবার নীতি
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
              মোট: {toBengaliNumber(workerMonthAttendance.length)} দিন
            </span>

            {/* View Mode Toggle (Card View vs Table View) */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setAttendanceViewMode('card')}
                className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                  attendanceViewMode === 'card'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="মোবাইল বা ছোট স্ক্রিনে সহজে প্রতিটি দিন স্পষ্টভাবে দেখুন"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>কার্ড ভিউ</span>
              </button>
              <button
                type="button"
                onClick={() => setAttendanceViewMode('table')}
                className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                  attendanceViewMode === 'table'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="তালিকা টেবিল আকারে দেখুন"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>টেবিল ভিউ</span>
              </button>
            </div>
          </div>
        </div>

        {workerMonthAttendance.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Clock className="w-10 h-10 mx-auto opacity-40" />
            <p className="text-xs font-semibold text-slate-600">
              {selectedMonth} {selectedYear} এ কোনো হাজিরার রেকর্ড পাওয়া যায়নি।
            </p>
            <p className="text-[11px] text-slate-400">
              অন্য কোনো মাস নির্বাচন করে দেখতে পারেন।
            </p>
          </div>
        ) : attendanceViewMode === 'card' ? (
          /* ================= 1. CARD VIEW (মোবাইল ও যেকোনো ডিভাইসে সম্পূর্ণ স্পষ্ট, কোনো লেখা কাটবে না) ================= */
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] text-slate-500 bg-blue-50/60 px-3 py-1.5 rounded-xl border border-blue-100">
              <span>💡 প্রতিটি কার্ডে ওই দিনের ইন-টাইম, আউট-টাইম, কাজের সময় ও ওটি স্পষ্টভাবে দেওয়া আছে।</span>
              <span className="font-bold text-blue-700 hidden sm:inline">কার্ড ভিউ সক্রিয়</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {workerMonthAttendance.map((rec) => {
                const isFri = isFriday(rec.date);
                const dayName = getBengaliDayName(rec.date) || '—';
                const otNum = Number(rec.otHours) || 0;
                const breakInfo = isFri ? getFridayBreakInfo(rec.inTime, rec.outTime) : null;

                return (
                  <div
                    key={rec.id}
                    className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
                      isFri
                        ? 'bg-amber-50/40 border-amber-300 ring-1 ring-amber-200/50'
                        : rec.status === 'absent'
                        ? 'bg-rose-50/30 border-rose-200'
                        : rec.status === 'late'
                        ? 'bg-amber-50/20 border-amber-200'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    {/* Card Top: Date, Day & Status Badge */}
                    <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                      <div>
                        <div className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                          <span>{formatDateBn(rec.date)}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                            isFri ? 'bg-amber-100 text-amber-900 font-black border border-amber-300' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {dayName}
                          </span>
                        </div>
                        {isFri && (
                          <div className="text-[10px] text-amber-800 font-semibold mt-0.5 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            <span>সাপ্তাহিক ছুটি (হাজিরা ০ দিন, শুধু ওটি গণ্য)</span>
                          </div>
                        )}
                      </div>

                      {/* Status Badge */}
                      <div className="shrink-0">
                        {isFri ? (
                          otNum > 0 || (rec.inTime && rec.outTime) ? (
                            <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-900 font-black border border-indigo-300 text-[11px] inline-flex items-center gap-1 shadow-2xs">
                              <Sparkles className="w-3 h-3 text-indigo-600" />
                              <span>শুক্রবার ওটি</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-300 text-[10px]">
                              সাপ্তাহিক বন্ধ
                            </span>
                          )
                        ) : rec.status === 'present' ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-black border border-emerald-300 text-xs shadow-2xs">
                            ✓ উপস্থিত
                          </span>
                        ) : rec.status === 'absent' ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 font-black border border-rose-300 text-xs shadow-2xs">
                            ✕ অনুপস্থিত
                          </span>
                        ) : rec.status === 'late' ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-black border border-amber-300 text-xs shadow-2xs">
                            ⏰ লেট / বিলম্ব
                          </span>
                        ) : rec.status === 'half_day' ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 font-bold border border-blue-200 text-xs">
                            হাফ-ডে
                          </span>
                        ) : rec.status === 'leave' ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 font-bold border border-purple-200 text-xs">
                            অনুমোদিত ছুটি
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs">
                            {rec.status}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Body: In/Out Times & Working Hours Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-500 block font-medium">ইন-টাইম (In):</span>
                        <span className="font-mono font-black text-slate-900 text-xs">
                          {rec.inTime || '—'}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-500 block font-medium">আউট-টাইম (Out):</span>
                        <span className="font-mono font-black text-slate-900 text-xs">
                          {rec.outTime || '—'}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-500 block font-medium">স্বাভাবিক সময়:</span>
                        <span className="font-bold text-slate-800 text-xs">
                          {isFri
                            ? '০ ঘণ্টা (ছুটি)'
                            : rec.status === 'present' || rec.status === 'late'
                            ? '৮ ঘণ্টা'
                            : rec.status === 'half_day'
                            ? '৪ ঘণ্টা'
                            : '—'}
                        </span>
                      </div>
                      <div className={`p-2 rounded-xl border ${
                        otNum > 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100'
                      }`}>
                        <span className={`text-[10px] block font-medium ${
                          otNum > 0 ? 'text-indigo-700 font-bold' : 'text-slate-500'
                        }`}>
                          ওভারটাইম (OT):
                        </span>
                        <span className={`font-mono font-black text-xs ${
                          otNum > 0 ? 'text-indigo-950 text-sm' : 'text-slate-400'
                        }`}>
                          {otNum > 0 ? `${toBengaliNumber(otNum)} ঘণ্টা` : '০ ঘণ্টা'}
                        </span>
                      </div>
                    </div>

                    {/* Additional Notes or Details */}
                    {((rec.lateMinutes && rec.lateMinutes > 0) || (isFri && breakInfo?.hasBreakDeduction) || rec.note) && (
                      <div className="text-[11px] pt-1.5 border-t border-slate-100 space-y-0.5">
                        {rec.lateMinutes && rec.lateMinutes > 0 ? (
                          <div className="text-amber-700 font-bold flex items-center gap-1">
                            <span>⚠️ {toBengaliNumber(rec.lateMinutes)} মিনিট লেট</span>
                          </div>
                        ) : null}
                        {isFri && breakInfo?.hasBreakDeduction && (
                          <div className="text-amber-800 font-semibold">
                            ℹ️ ১ ঘণ্টা জুমার নামাজের বিরতি কর্তন হয়েছে
                          </div>
                        )}
                        {rec.note && (
                          <div className="text-slate-600">
                            📝 মন্তব্য: {rec.note}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ================= 2. TABLE VIEW (সম্পূর্ণ স্ক্রোলেবল এবং পর্যাপ্ত উইডথ সহ) ================= */
          <div className="space-y-2">
            <div className="sm:hidden flex items-center justify-between text-[11px] text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200">
              <span>👉 ডানে-বামে টেনে পুরো টেবিল দেখুন</span>
              <button
                type="button"
                onClick={() => setAttendanceViewMode('card')}
                className="font-black underline cursor-pointer"
              >
                কার্ড ভিউতে যান
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
              <table className="min-w-[680px] w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                    <th className="py-3 px-3.5 font-bold whitespace-nowrap">তারিখ ও বার</th>
                    <th className="py-3 px-3.5 font-bold whitespace-nowrap">স্ট্যাটাস / হাজিরা</th>
                    <th className="py-3 px-3.5 font-bold whitespace-nowrap">ইন-টাইম (In)</th>
                    <th className="py-3 px-3.5 font-bold whitespace-nowrap">আউট-টাইম (Out)</th>
                    <th className="py-3 px-3.5 font-bold whitespace-nowrap">স্বাভাবিক কর্মঘণ্টা</th>
                    <th className="py-3 px-3.5 font-bold text-right whitespace-nowrap">ওভারটাইম (OT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium bg-white">
                  {workerMonthAttendance.map((rec) => {
                    const isFri = isFriday(rec.date);
                    const dayName = getBengaliDayName(rec.date) || '—';
                    const otNum = Number(rec.otHours) || 0;
                    const breakInfo = isFri ? getFridayBreakInfo(rec.inTime, rec.outTime) : null;

                    return (
                      <tr
                        key={rec.id}
                        className={`hover:bg-slate-50/80 transition ${
                          isFri
                            ? 'bg-amber-50/35 border-l-4 border-l-amber-500'
                            : rec.status === 'absent'
                            ? 'bg-rose-50/30'
                            : ''
                        }`}
                      >
                        {/* Date & Day */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <div className="font-black text-slate-900">{formatDateBn(rec.date)}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <span className={isFri ? 'font-black text-amber-800' : ''}>{dayName}</span>
                            {isFri && (
                              <span className="font-bold text-amber-800 bg-amber-100 px-1 rounded text-[9px] border border-amber-300">
                                সাপ্তাহিক ছুটি
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status / Attendance: FRIDAY ONLY COUNTS OT, NO ATTENDANCE! */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          {isFri ? (
                            otNum > 0 || (rec.inTime && rec.outTime) ? (
                              <div>
                                <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 font-black border border-indigo-300 text-[11px] inline-flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-indigo-600" />
                                  <span>শুক্রবার (শুধু ওটি)</span>
                                </span>
                                <div className="text-[9px] text-indigo-700 font-semibold mt-0.5">
                                  সাপ্তাহিক ছুটি • হাজিরা ০ দিন
                                </div>
                              </div>
                            ) : (
                              <div>
                                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-300 text-[11px]">
                                  সাপ্তাহিক ছুটি (বন্ধ)
                                </span>
                                <div className="text-[9px] text-slate-500 mt-0.5">
                                  কারখানা বন্ধ • কোনো মিস নেই
                                </div>
                              </div>
                            )
                          ) : rec.status === 'present' ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[11px]">
                              উপস্থিত
                            </span>
                          ) : rec.status === 'absent' ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200 text-[11px]">
                              অনুপস্থিত (Missed)
                            </span>
                          ) : rec.status === 'late' ? (
                            <div>
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200 text-[11px]">
                                লেট / বিলম্ব
                              </span>
                              {rec.lateMinutes && rec.lateMinutes > 0 ? (
                                <div className="text-[9px] text-amber-700 font-semibold mt-0.5">
                                  {toBengaliNumber(rec.lateMinutes)} মি. দেরি
                                </div>
                              ) : null}
                            </div>
                          ) : rec.status === 'half_day' ? (
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200 text-[11px]">
                              হাফ-ডে
                            </span>
                          ) : rec.status === 'leave' ? (
                            <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold border border-purple-200 text-[11px]">
                              ছুটি (Leave)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px]">
                              {rec.status}
                            </span>
                          )}
                        </td>

                        {/* In Time */}
                        <td className="py-2.5 px-3.5 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {rec.inTime || '—'}
                        </td>

                        {/* Out Time */}
                        <td className="py-2.5 px-3.5 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {rec.outTime || '—'}
                        </td>

                        {/* Regular Working Hours */}
                        <td className="py-2.5 px-3.5 text-slate-600 font-medium whitespace-nowrap">
                          {isFri ? (
                            <span className="text-amber-800 font-bold text-[11px]">
                              ০ ঘণ্টা (ছুটি)
                            </span>
                          ) : rec.status === 'present' || rec.status === 'late' ? (
                            <span>৮ ঘণ্টা</span>
                          ) : rec.status === 'half_day' ? (
                            <span>৪ ঘণ্টা</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Overtime (OT) Hours */}
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          {otNum > 0 ? (
                            <div>
                              <span className="font-black text-indigo-700 font-mono text-sm bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                                {toBengaliNumber(otNum)} ঘণ্টা
                              </span>
                              {isFri && breakInfo && breakInfo.hasBreakDeduction && (
                                <div className="text-[9px] text-amber-700 font-semibold mt-0.5">
                                  ১ ঘণ্টা নামাজের বিরতি বাদ
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
        </div>
      )}

      {/* ================= 2. WORKER NOTICES TAB (নোটিশ বোর্ড) ================= */}
      {portalTab === 'notices' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                    <span>শ্রমিক নোটিশ বোর্ড</span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs font-bold">
                      {toBengaliNumber(myNotices.length)}টি নোটিশ
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    কারখানা প্রশাসন থেকে আপনার জন্য প্রেরিত ব্যক্তিগত ও সাধারণ নোটিশসমূহ
                  </p>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setNoticeFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    noticeFilter === 'all'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  সকল ({toBengaliNumber(myNotices.length)})
                </button>
                <button
                  type="button"
                  onClick={() => setNoticeFilter('unread')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                    noticeFilter === 'unread'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  <span>অপঠিত</span>
                  {unreadNoticesCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-white text-rose-700 rounded-full text-[10px] font-black">
                      {toBengaliNumber(unreadNoticesCount)}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setNoticeFilter('individual')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    noticeFilter === 'individual'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  }`}
                >
                  ব্যক্তিগত
                </button>
                <button
                  type="button"
                  onClick={() => setNoticeFilter('factory')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    noticeFilter === 'factory'
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  সাধারণ
                </button>
              </div>
            </div>

            {/* Notices List */}
            {filteredNotices.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <Bell className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="font-bold text-sm">কোনো নোটিশ পাওয়া যায়নি</p>
                <p className="text-xs text-slate-400">
                  {noticeFilter === 'unread'
                    ? 'আপনার সকল নোটিশ পঠিত হয়েছে।'
                    : 'বর্তমানে কারখানা প্রশাসন থেকে কোনো সক্রিয় নোটিশ নেই।'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 mt-2">
                {filteredNotices.map((notice) => {
                  const isRead = notice.readBy?.includes(loggedInWorker.id);
                  const isPersonal = notice.targetType === 'individual';
                  const catBadge = getNoticeCategoryBadge(notice.category);
                  const prioBadge = getNoticePriorityBadge(notice.priority);

                  return (
                    <div
                      key={notice.id}
                      className={`py-4 transition rounded-xl px-3 my-1.5 ${
                        !isRead ? 'bg-purple-50/50 border-l-4 border-purple-500' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isPersonal ? (
                            <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[11px] font-black border border-indigo-200 inline-flex items-center gap-1">
                              <User className="w-3 h-3 text-indigo-600" />
                              <span>ব্যক্তিগত নোটিশ (শুধু আপনার জন্য)</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200 inline-flex items-center gap-1">
                              <Users className="w-3 h-3 text-slate-500" />
                              <span>সকল শ্রমিকের জন্য</span>
                            </span>
                          )}

                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${catBadge.bg}`}>
                            {catBadge.label}
                          </span>

                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${prioBadge.bg}`}>
                            {prioBadge.label}
                          </span>

                          {!isRead && (
                            <span className="px-2 py-0.5 rounded-md bg-rose-500 text-white text-[10px] font-black">
                              নতুন / অপঠিত
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDateBn(notice.publishedDate || (notice.createdAt ? new Date(notice.createdAt).toISOString().split('T')[0] : ''))}</span>
                        </div>
                      </div>

                      <h4 className="font-black text-sm text-slate-900 mt-1">
                        {notice.title}
                      </h4>

                      <p className="text-xs text-slate-700 mt-1.5 whitespace-pre-wrap leading-relaxed bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                        {notice.message}
                      </p>

                      <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-slate-500 flex-wrap">
                        <span className="text-[11px] text-slate-500">
                          প্রেরক: <b>{notice.createdBy || 'কারখানা প্রশাসন ও এইচআর'}</b>
                        </span>

                        {!isRead ? (
                          <button
                            type="button"
                            onClick={() => handleMarkNoticeAsRead(notice.id)}
                            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer active:scale-95 shadow-xs"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>পঠিত হিসেবে চিহ্নিত করুন</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>পঠিত</span>
                          </span>
                        )}
                      </div>

                      {/* নোটিশ প্রাপ্তি ও বুঝ নিশ্চিতকরণ (Worker Confirmation) */}
                      {(() => {
                        const isConfirmed = notice.confirmations?.some((c) => c.employeeId === loggedInWorker.id);
                        const myConf = notice.confirmations?.find((c) => c.employeeId === loggedInWorker.id);

                        return isConfirmed ? (
                          <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>
                                ✓ আপনি এই নোটিশটি পড়েছেন এবং নিশ্চিত করেছেন
                                {myConf?.confirmedAt && (
                                  <span className="font-normal text-emerald-700 ml-1">
                                    ({new Date(myConf.confirmedAt).toLocaleDateString('bn-BD')} — {new Date(myConf.confirmedAt).toLocaleTimeString('bn-BD')})
                                  </span>
                                )}
                              </span>
                            </div>
                            <span className="text-[10px] font-black bg-emerald-200 text-emerald-950 px-2 py-0.5 rounded-full">
                              অ্যাডমিন রেকর্ডে নিশ্চিতকৃত
                            </span>
                          </div>
                        ) : (
                          <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="text-xs text-amber-900">
                              <span className="font-bold">⚠️ নোটিশ প্রাপ্তি নিশ্চিতকরণ:</span>
                              <span className="text-[11px] text-amber-800 ml-1">
                                নোটিশ পড়া হলে নিচের বোতামে চাপ দিয়ে অ্যাডমিনকে নিশ্চিত করুন।
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleConfirmNotice(notice.id)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs shrink-0"
                            >
                              <CheckCheck className="w-4 h-4" />
                              <span>পড়েছি ও বুঝেছি — নিশ্চিত করলাম</span>
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= 3. SALARY STATUS, TIMELINE & HISTORY TAB (তারিখ অনুযায়ী বেতনের অবস্থান) ================= */}
      {portalTab === 'salary' && (
        <div className="space-y-4">
          {/* Month/Year selector inside Salary Tab */}
          <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-xs text-slate-800">যে মাসের বেতনের অবস্থান দেখতে চান:</span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-xl bg-slate-50 font-bold text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
              >
                {BENGALI_MONTHS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(Number(e.target.value))}
                className="px-3 py-1.5 border border-slate-300 rounded-xl bg-slate-50 font-mono font-bold text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
              >
                {getDynamicYears().map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Prior period info banner if month is before October 2026 */}
          {isPriorPeriod && (
            <div className="bg-amber-50 border border-amber-300/80 rounded-2xl p-4 text-xs text-amber-950 flex items-start gap-3 shadow-xs animate-in fade-in">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-950 text-xs sm:text-sm">
                  কারখানা চালুর পূর্ববর্তী সময়কাল ({selectedMonth} {selectedYear})
                </h4>
                <p className="text-amber-800 text-[11px] sm:text-xs mt-1 leading-relaxed">
                  টেক্স ওয়ার অ্যাপারেলসের সকল ডিজিটাল বেতন ও পে-স্লিপ হিসাব <b>১লা অক্টোবর ২০২৬</b> তারিখ থেকে শুরু হয়েছে। অক্টোবর ২০২৬ থেকে পরবর্তী সকল মাসের বেতন বিবরণী ও অগ্রগতি স্বয়ংক্রিয়ভাবে এখানে হিসাবভুক্ত হবে।
                </p>
              </div>
            </div>
          )}

          {/* Current Month Status & 4-Step Stepper Card */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-slate-500">
                  বেতনের বর্তমান পর্যায় ({selectedMonth} {selectedYear})
                </span>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <h3 className="text-lg font-black text-slate-900">
                    স্ট্যাটাস: <span className="text-emerald-700">{progressInfo.label}</span>
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${progressInfo.badge}`}>
                    ধাপ {toBengaliNumber(progressInfo.step)} / ৪
                  </span>
                </div>
              </div>

              {/* Status Updated Date (তারিখ অনুযায়ী) */}
              <div className="text-left sm:text-right bg-slate-50 sm:bg-transparent p-2.5 sm:p-0 rounded-xl border sm:border-0 border-slate-200">
                <div className="text-xs text-slate-500 font-medium">অ্যাডমিন কর্তৃক শেষ আপডেট তারিখ:</div>
                <div className="font-mono font-black text-xs text-slate-900 mt-0.5 flex items-center sm:justify-end gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>
                    {currentMonthSalary?.statusUpdatedDate
                      ? formatDateBn(currentMonthSalary.statusUpdatedDate)
                      : currentMonthSalary?.statusUpdatedAt
                      ? formatDateBn(new Date(currentMonthSalary.statusUpdatedAt).toISOString().split('T')[0])
                      : 'চলতি মাস (বেতন বাকী)'}
                  </span>
                </div>
              </div>
            </div>

            {/* 4-Step Visual Stepper */}
            <div className="py-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { key: 'due', step: 1, label: 'বাকী', desc: 'বেতন পরিশোধ বাকী রয়েছে', activeBg: 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/30', activeBadge: 'bg-rose-600 text-white' },
                  { key: 'calculated', step: 2, label: 'হিসাব সম্পূর্ণ', desc: 'মোট নিট বেতন চূড়ান্তকৃত', activeBg: 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/30', activeBadge: 'bg-blue-600 text-white' },
                  { key: 'ready', step: 3, label: 'বেতন দেওয়ার জন্য প্রস্তুত', desc: 'অনুমোদন ও অর্থ প্রস্তুত', activeBg: 'bg-purple-50 border-purple-300 ring-2 ring-purple-500/30', activeBadge: 'bg-purple-600 text-white' },
                  { key: 'disbursed', step: 4, label: 'বেতন প্রদান করা সম্পূর্ণ', desc: 'অর্থ বিতরণ সম্পন্ন', activeBg: 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/30', activeBadge: 'bg-emerald-600 text-white' },
                ].map((st) => {
                  const isCurrent = progressInfo.step === st.step;
                  const isPassed = progressInfo.step > st.step;
                  const isFinalDone = progressInfo.step === 4 && st.step === 4;

                  return (
                    <div
                      key={st.key}
                      className={`p-3 rounded-xl border text-center transition ${
                        isCurrent
                          ? st.activeBg
                          : isPassed
                          ? 'bg-teal-50/70 border-teal-200'
                          : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-center mb-1">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                          isFinalDone || isPassed
                            ? 'bg-emerald-600 text-white'
                            : isCurrent
                            ? st.activeBadge
                            : 'bg-slate-200 text-slate-600'
                        }`}>
                          {isFinalDone || isPassed ? '✓' : toBengaliNumber(st.step)}
                        </span>
                      </div>
                      <div className="font-black text-xs text-slate-900">{st.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{st.desc}</div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-600 mt-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                ℹ️ <b>বর্তমান অবস্থা:</b> {progressInfo.desc}
                {currentMonthSalary?.note && (
                  <span className="block mt-1 text-slate-700 font-semibold">
                    অ্যাডমিন নোট: {currentMonthSalary.note}
                  </span>
                )}
              </p>
            </div>

            {/* Salary Breakdown Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 font-bold text-xs text-slate-800 flex justify-between items-center">
                <span>{selectedMonth} মাসের পূর্ণাঙ্গ হিসাব বিবরণী</span>
                <span className="text-[11px] font-normal text-slate-500">
                  {currentMonthSalary ? 'অ্যাডমিন সংরক্ষিত রেকর্ড' : 'চলতি সম্ভাব্য হিসাব'}
                </span>
              </div>

              <div className="p-3 sm:p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-600">মূল বেতন (Basic Salary):</span>
                  <span className="font-bold text-slate-900 font-mono">
                    ৳ {formatMoney(Number(loggedInWorker.salary || 0))}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-600">উপস্থিতি (কার্যকর হাজিরা):</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {toBengaliNumber(effectivePresentDays)} দিন
                    <span className="text-[11px] font-normal text-slate-500 ml-1">
                      {joinPolicy.isNewJoinerMidMonth ? (
                        '(নতুন কর্মী: শুধু উপস্থিতি, কোনো কর্তন নেই)'
                      ) : (
                        `(উপস্থিত ${toBengaliNumber(currentMonthSalary?.presentDays ?? stats.presentCount)} - পেনাল্টি ${toBengaliNumber(penaltyInfo.totalPenaltyDays)})`
                      )}
                    </span>
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-600">উপস্থিত বেতন (Earned Basic):</span>
                  <span className="font-bold text-slate-900 font-mono">
                    ৳ {formatMoney(currentMonthSalary?.presentSalary ?? Math.round(((Number(loggedInWorker.salary || 0) / 26) * effectivePresentDays)))}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-600">
                    ওভারটাইম ({toBengaliNumber(currentMonthSalary?.otHours ?? stats.totalOtHours)} ঘণ্টা @ ৳{toBengaliNumber(Number(loggedInWorker.otRate || 0))}/ঘ.):
                  </span>
                  <span className="font-bold text-indigo-700 font-mono">
                    ৳ {formatMoney(currentMonthSalary?.otPay ?? Math.round((stats.totalOtHours || 0) * (Number(loggedInWorker.otRate) || 0)))}
                  </span>
                </div>

                {/* হাজিরা বোনাস অটো রুল */}
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-600">হাজিরা বোনাস (অটো হিসাব):</span>
                  <span className="font-bold font-mono">
                    {(currentMonthSalary ? (currentMonthSalary.bonus || 0) : autoBonusAmount) > 0 ? (
                      <span className="text-emerald-700">
                        +৳ {formatMoney(currentMonthSalary?.bonus ?? autoBonusAmount)} (পূর্ণ উপস্থিতি)
                      </span>
                    ) : joinPolicy.isNewJoinerMidMonth ? (
                      <span className="text-amber-700 text-[11px]">
                        ৳ ০ (নতুন কর্মীর খণ্ডিত মাসে বোনাস নেই - পরবর্তী মাস থেকে প্রযোজ্য)
                      </span>
                    ) : (
                      <span className="text-rose-600 text-[11px]">
                        ৳ ০ (অনুপস্থিত {toBengaliNumber(currentMonthSalary?.absentDays ?? stats.absentCount)} বা লেট {toBengaliNumber(currentMonthSalary?.lateDays ?? stats.lateCount)} থাকায় বাতিল)
                      </span>
                    )}
                  </span>
                </div>

                {(currentMonthSalary?.advance || 0) > 0 && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 text-rose-700">
                    <span>অগ্রিম বেতন কর্তন:</span>
                    <span className="font-bold font-mono">-৳ {formatMoney(currentMonthSalary?.advance || 0)}</span>
                  </div>
                )}

                {(currentMonthSalary?.deduction || 0) > 0 && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 text-rose-700">
                    <span>অন্যান্য কর্তন {currentMonthSalary?.deductionReason ? `(${currentMonthSalary.deductionReason})` : ''}:</span>
                    <span className="font-bold font-mono">-৳ {formatMoney(currentMonthSalary?.deduction || 0)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 font-black text-sm text-slate-900 bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">
                  <span>সর্বমোট প্রদেয় নিট বেতন:</span>
                  <span className="text-emerald-800 text-base font-mono">
                    ৳ {formatMoney(currentMonthSalary?.netPayable ?? estimatedPayable)}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-1 text-xs">
                  <span className="text-slate-500">পরিশোধের অবস্থা:</span>
                  <span className={`px-2 py-0.5 rounded-md font-black ${
                    (currentMonthSalary?.paymentStatus === 'paid' || currentMonthSalary?.progressStatus === 'disbursed')
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {(currentMonthSalary?.paymentStatus === 'paid' || currentMonthSalary?.progressStatus === 'disbursed')
                      ? 'পরিশোধিত (Paid)'
                      : 'বকেয়া / অনিষ্পন্ন'}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              {currentMonthSalary && (
                <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedSlipRecord(currentMonthSalary)}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>পে-স্লিপ দেখুন ও প্রিন্ট করুন</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Salary History Across Months (তারিখ অনুযায়ী হিস্ট্রি) */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                <h4 className="font-black text-sm text-slate-900">
                  পূর্ববর্তী মাসের বেতন প্রদান ও স্ট্যাটাস হিস্ট্রি
                </h4>
              </div>
              <span className="text-xs text-slate-500">
                মোট {toBengaliNumber(workerSalaryHistory.length)}টি রেকর্ড
              </span>
            </div>

            {workerSalaryHistory.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                পূর্ববর্তী কোনো বেতন রেকর্ড সংরক্ষিত নেই।
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">মাস ও বছর</th>
                      <th className="py-2 px-3">স্ট্যাটাসের অবস্থান</th>
                      <th className="py-2 px-3">আপডেট তারিখ</th>
                      <th className="py-2 px-3">নিট বেতন</th>
                      <th className="py-2 px-3">অবস্থা</th>
                      <th className="py-2 px-3 text-right">পে-স্লিপ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {workerSalaryHistory.map((rec) => {
                      const prog = getSalaryProgressInfo(rec.progressStatus, rec.paymentStatus);
                      return (
                        <tr key={rec.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {rec.month} {rec.year}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${prog.badge}`}>
                              {prog.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {rec.statusUpdatedDate
                              ? formatDateBn(rec.statusUpdatedDate)
                              : rec.statusUpdatedAt
                              ? formatDateBn(new Date(rec.statusUpdatedAt).toISOString().split('T')[0])
                              : '—'}
                          </td>
                          <td className="py-2.5 px-3 font-bold font-mono text-slate-900">
                            ৳ {formatMoney(rec.netPayable)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              rec.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {rec.paymentStatus === 'paid' ? 'পরিশোধিত' : 'বকেয়া'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedSlipRecord(rec)}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>স্লিপ</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= 4. COMPACT READ-ONLY WORKER PROFILE TAB ================= */}
      {portalTab === 'profile' && (
        <WorkerProfileReadOnly
          employee={loggedInWorker}
          onOpenPhotoModal={() => setShowPhotoModal(true)}
          onBackToAttendance={() => setPortalTab('attendance')}
          onOpenInstallModal={() => setShowInstallModal(true)}
          showToast={showToast}
        />
      )}

      {/* 6. Official Profile Summary Card (Visible on non-profile tabs) */}
      {portalTab !== 'profile' && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-3">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-900">
                ব্যক্তিগত ও পরিচয় তথ্য
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />
                <span>রিড-অনলি</span>
              </span>
              <button
                type="button"
                onClick={() => setPortalTab('profile')}
                className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition shadow-xs active:scale-95"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>একনজরে পূর্ণাঙ্গ প্রোফাইল</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block">জাতীয় পরিচয়পত্র (NID):</span>
              <span className="font-mono font-bold text-slate-900">{loggedInWorker.nid || 'রেকর্ড নেই'}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block">মোবাইল নম্বর:</span>
              <span className="font-mono font-bold text-slate-900">{loggedInWorker.mobile || '—'}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block">জন্ম তারিখ:</span>
              <span className="font-bold text-slate-900">{formatDateBn(loggedInWorker.birthDate)}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 sm:col-span-2">
              <span className="text-slate-500 block">বর্তমান ঠিকানা:</span>
              <span className="font-medium text-slate-900">{loggedInWorker.address || '—'}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block">ব্যাংক / বিকাশ তথ্য:</span>
              <span className="font-mono font-bold text-slate-900">
                {loggedInWorker.bankName ? `${loggedInWorker.bankName} (${loggedInWorker.accountNumber})` : 'ক্যাশ'}
              </span>
            </div>
          </div>

          {/* Digital Signature Card */}
          {loggedInWorker.signatureUrl && (
            <div className="pt-2 flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700">ডিজিটাল স্বাক্ষর:</span>
              <div className="h-10 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg flex items-center">
                <img
                  src={loggedInWorker.signatureUrl}
                  alt="Signature"
                  className="max-h-8 object-contain"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      {/* 1. Read-Only Photo & ID Card Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <IdCard className="w-5 h-5 text-blue-600" />
                <h4 className="font-black text-sm text-slate-900">শ্রমিক পরিচয়পত্র (ID Card)</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowPhotoModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            {/* ID Card Box */}
            <div className="rounded-2xl border-2 border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 space-y-3.5 shadow-xs">
              <div className="text-center border-b border-slate-200 pb-2.5">
                <p className="font-black text-xs text-slate-900">{factory.name || 'টেক্স ওয়ার অ্যাপারেলস'}</p>
                <p className="text-[10px] text-slate-500 font-semibold">{factory.address || 'কারখানা আইডি কার্ড'}</p>
              </div>

              {/* Photo */}
              <div className="flex justify-center">
                <div className="w-24 h-28 rounded-2xl bg-slate-100 border-2 border-blue-500/40 overflow-hidden shadow-sm flex items-center justify-center">
                  {loggedInWorker.photoUrl ? (
                    <img
                      src={loggedInWorker.photoUrl}
                      alt={loggedInWorker.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-12 h-12 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Identity details */}
              <div className="text-center space-y-0.5">
                <h5 className="font-black text-base text-slate-900">{loggedInWorker.name}</h5>
                <p className="text-xs font-bold text-blue-700">{loggedInWorker.designation}</p>
                <div className="pt-1 flex items-center justify-center gap-2">
                  <span className="font-mono font-black text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    ID: {loggedInWorker.workerId}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    সেকশন: {loggedInWorker.department || 'সুইং'}
                  </span>
                </div>
              </div>

              {/* Card Meta details */}
              <div className="bg-slate-50 rounded-xl p-2.5 text-[11px] space-y-1 border border-slate-200 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">মোবাইল:</span>
                  <span className="font-mono font-bold text-slate-900">{loggedInWorker.mobile || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">এনআইডি:</span>
                  <span className="font-mono font-bold text-slate-900">{loggedInWorker.nid || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">যোগদানের তারিখ:</span>
                  <span className="font-bold text-slate-900">{formatDateBn(loggedInWorker.joinDate)}</span>
                </div>
              </div>

              {/* Signature */}
              {loggedInWorker.signatureUrl && (
                <div className="pt-1 border-t border-dashed border-slate-200 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">অনুমোদিত স্বাক্ষর:</span>
                  <img
                    src={loggedInWorker.signatureUrl}
                    alt="Signature"
                    className="h-8 max-w-[120px] object-contain"
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowPhotoModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer transition active:scale-95"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}

      {/* 2. Salary Slip View Modal */}
      {selectedSlipRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h4 className="font-bold text-sm text-slate-900">পে-স্লিপ প্রিন্ট ভিউ</h4>
              <button
                type="button"
                onClick={() => setSelectedSlipRecord(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                ✕
              </button>
            </div>

            {/* Thermal POS 58mm Slip Box */}
            <div
              id="workerPortalSlipArea"
              className="bg-white p-3 border border-slate-300 rounded text-xs font-mono space-y-2 text-slate-900"
              style={{ width: '100%', maxWidth: '58mm', margin: '0 auto' }}
            >
              <div className="text-center border-b border-dashed border-slate-400 pb-2">
                <div className="font-black text-sm">{factory.name || 'TEXWARE APPARELS'}</div>
                <div className="text-[10px]">{factory.address}</div>
                <div className="font-bold text-xs mt-1">বেতন রসিদ — {selectedSlipRecord.month} {selectedSlipRecord.year}</div>
              </div>

              <div className="text-[11px] space-y-0.5 border-b border-dashed border-slate-400 pb-2">
                <div>আইডি: <b>{selectedSlipRecord.workerId}</b></div>
                <div>নাম: <b>{selectedSlipRecord.employeeName}</b></div>
                <div>পদবী: {selectedSlipRecord.designation}</div>
                <div>মূল বেতন: ৳ {formatMoney(selectedSlipRecord.salary)}</div>
              </div>

              <div className="text-[11px] space-y-1 border-b border-dashed border-slate-400 pb-2">
                <div className="flex justify-between">
                  <span>উপস্থিত বেতন:</span>
                  <span>৳ {formatMoney(selectedSlipRecord.presentSalary)}</span>
                </div>
                <div className="flex justify-between">
                  <span>ওটি ({selectedSlipRecord.otHours} ঘ.):</span>
                  <span>৳ {formatMoney(selectedSlipRecord.otPay)}</span>
                </div>
                {selectedSlipRecord.bonus > 0 && (
                  <div className="flex justify-between">
                    <span>বোনাস:</span>
                    <span>৳ {formatMoney(selectedSlipRecord.bonus)}</span>
                  </div>
                )}
                {selectedSlipRecord.advance > 0 && (
                  <div className="flex justify-between text-rose-700">
                    <span>অগ্রিম কর্তন:</span>
                    <span>-৳ {formatMoney(selectedSlipRecord.advance)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-xs pt-1 border-t border-slate-300">
                  <span>মোট প্রদেয়:</span>
                  <span>৳ {formatMoney(selectedSlipRecord.netPayable)}</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-500 pt-1">
                পরিশোধ অবস্থা: {selectedSlipRecord.paymentStatus === 'paid' ? 'পরিশোধিত' : 'বকেয়া'}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handlePrintSlip}
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>প্রিন্ট করুন</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedSlipRecord(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-100"
              >
                বন্ধ
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Phone App Install Modal */}
      <InstallAppModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        appName="টেক্স ওয়ার শ্রমিক অ্যাপ"
        appSubtitle="শ্রমিকদের নিজস্ব হাজিরা ও বেতন বিবরণী দেখার মোবাইল অ্যাপ"
        mode="worker"
      />
    </div>
  );
};
