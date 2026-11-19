import { AttendanceRecord, AttendanceStatus, ShiftSettings, EmployeeAttendanceStats } from '../types';
import { toEnglishNumber } from './utils';

export const DEFAULT_SHIFT_SETTINGS: ShiftSettings = {
  standardInTime: '08:00',
  standardOutTime: '17:00',
  graceMinutes: 15,
  standardHours: 8,
};

// কারখানা ও অ্যাপ চালুর শুরুর তারিখ: ১লা অক্টোবর ২০২৬ (অক্টোবরের আগের কোনো হিস্ট্রি সিস্টেমে থাকবে না)
export const FACTORY_APP_START_DATE = '2026-10-01';

/**
 * Returns today's date formatted as YYYY-MM-DD in local time
 */
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts "HH:mm" string to minutes from midnight
 */
export function timeStringToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * Converts minutes from midnight to "HH:mm" 24h format
 */
export function minutesToTimeString(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Converts "HH:mm" 24h time to 12-hour AM/PM Bengali friendly string
 */
export function formatTime12h(timeStr?: string): string {
  if (!timeStr) return '—';
  const mins = timeStringToMinutes(timeStr);
  if (mins === null) return timeStr;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Coerces an "HH:mm" 24h time string to stay within AM (00:00-11:59) or PM (12:00-23:59)
 */
export function coerceTimePeriod(timeStr: string, period: 'AM' | 'PM'): string {
  if (!timeStr) return timeStr;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return timeStr;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return timeStr;
  let adjustedHours = hours;
  if (period === 'AM' && hours >= 12) {
    adjustedHours = hours - 12;
  } else if (period === 'PM' && hours < 12) {
    adjustedHours = hours + 12;
  }
  return `${String(adjustedHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Checks if a date string (YYYY-MM-DD) is a Friday (5 in JS getDay)
 */
export function isFriday(dateStr?: string): boolean {
  if (!dateStr) return false;
  try {
    const cleanDate = dateStr.trim().split('T')[0].split(' ')[0];
    const parts = cleanDate.split('-');
    if (parts.length < 3) return false;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!y || !m || !d) return false;
    const dateObj = new Date(y, m - 1, d, 12, 0, 0);
    return dateObj.getDay() === 5;
  } catch {
    return false;
  }
}

/**
 * Returns Bengali day of week name (রবিবার, সোমবার, ইত্যাদি)
 */
export function getBengaliDayName(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const cleanDate = dateStr.trim().split('T')[0].split(' ')[0];
    const parts = cleanDate.split('-');
    if (parts.length < 3) return '';
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!y || !m || !d) return '';
    const dateObj = new Date(y, m - 1, d, 12, 0, 0);
    const days = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
    return days[dateObj.getDay()] || '';
  } catch {
    return '';
  }
}

/**
 * Calculates Friday lunch & prayer break deduction in minutes.
 * On Friday, 1:00 PM (13:00 = 780 mins) to 2:00 PM (14:00 = 840 mins) is deducted from working OT time.
 * (শুক্রবার দুপুর ১:০০টা থেকে ২:০০টা পর্যন্ত ১ ঘণ্টা নামাজের ও দুপুরের খাবারের বিরতি ওটি থেকে বাদ দেওয়া হয়)
 */
export function calculateFridayBreakDeductionMinutes(inMins: number, outMins: number): number {
  if (outMins <= inMins) return 0;
  const breakStart = 13 * 60; // 780 mins (1:00 PM / দুপুর ১:০০টা)
  const breakEnd = 14 * 60;   // 840 mins (2:00 PM / দুপুর ২:০০টা)
  return Math.max(0, Math.min(outMins, breakEnd) - Math.max(inMins, breakStart));
}

/**
 * Returns helper breakdown for Friday lunch & prayer break deduction.
 */
export function getFridayBreakInfo(inTime?: string, outTime?: string): {
  breakMinutes: number;
  breakDeductedHours: number;
  hasBreakDeduction: boolean;
} {
  const inMins = timeStringToMinutes(inTime);
  const outMins = timeStringToMinutes(outTime);
  if (inMins === null || outMins === null || outMins <= inMins) {
    return { breakMinutes: 0, breakDeductedHours: 0, hasBreakDeduction: false };
  }
  const breakMinutes = calculateFridayBreakDeductionMinutes(inMins, outMins);
  const breakDeductedHours = Math.round((breakMinutes / 60) * 2) / 2;
  return {
    breakMinutes,
    breakDeductedHours,
    hasBreakDeduction: breakMinutes > 0,
  };
}

/**
 * Calculates Friday OT hours:
 * 1. All working time is counted as overtime.
 * 2. Deducts 1 hour lunch & Juma prayer break from 1:00 PM to 2:00 PM (দুপুর ১টা থেকে ২টা পর্যন্ত ১ ঘণ্টা ওটি বাদ).
 */
export function calculateFridayOtHours(inTime?: string, outTime?: string): number {
  const inMins = timeStringToMinutes(inTime);
  const outMins = timeStringToMinutes(outTime);
  if (inMins === null || outMins === null || outMins <= inMins) {
    return 0;
  }
  const totalMinutes = outMins - inMins;
  const breakMinutes = calculateFridayBreakDeductionMinutes(inMins, outMins);
  const effectiveMinutes = Math.max(0, totalMinutes - breakMinutes);
  return Math.round((effectiveMinutes / 60) * 2) / 2;
}

/**
 * Calculates whether employee is late, late minutes, and overtime hours worked
 */
export function calculateAttendanceMetrics(
  inTime?: string,
  outTime?: string,
  shift: ShiftSettings = DEFAULT_SHIFT_SETTINGS,
  dateStr?: string
): {
  isLate: boolean;
  lateMinutes: number;
  otHours: number;
  fridayBreakDeductedMinutes?: number;
} {
  const isFri = isFriday(dateStr);

  // On Friday: Weekly holiday! All duty hours count purely as overtime hours (no late penalties)
  // এবং দুপুর ১টা থেকে ২টা পর্যন্ত (১:০০ PM - ২:০০ PM) খাবারের ও নামাজের বিরতি ১ ঘণ্টা ওটি থেকে বাদ দেওয়া হয়।
  if (isFri) {
    const shiftInMins = timeStringToMinutes(shift.standardInTime) ?? (8 * 60); // 08:00
    // If inTime is not explicitly given but outTime is present, fallback to standard shift start
    const inMins = timeStringToMinutes(inTime) ?? (outTime ? shiftInMins : null);
    const outMins = timeStringToMinutes(outTime);
    let otHours = 0;
    let fridayBreakDeductedMinutes = 0;
    if (inMins !== null && outMins !== null && outMins > inMins) {
      fridayBreakDeductedMinutes = calculateFridayBreakDeductionMinutes(inMins, outMins);
      const effectiveMinutes = Math.max(0, (outMins - inMins) - fridayBreakDeductedMinutes);
      otHours = Math.round((effectiveMinutes / 60) * 2) / 2;
    }
    return { isLate: false, lateMinutes: 0, otHours, fridayBreakDeductedMinutes };
  }

  let isLate = false;
  let lateMinutes = 0;
  let otHours = 0;

  const inMins = timeStringToMinutes(inTime);
  const shiftInMins = timeStringToMinutes(shift.standardInTime) ?? (8 * 60); // 08:00
  const grace = shift.graceMinutes || 0;

  if (inMins !== null) {
    if (inMins > (shiftInMins + grace)) {
      isLate = true;
      lateMinutes = inMins - shiftInMins;
    }
  }

  const outMins = timeStringToMinutes(outTime);
  const shiftOutMins = timeStringToMinutes(shift.standardOutTime) ?? (17 * 60); // 17:00

  // Regular days: Overtime calculation
  // 1. Evening overtime (beyond shift standard out time)
  const lateOtMins = (outMins !== null && outMins > shiftOutMins) ? (outMins - shiftOutMins) : 0;
  // 2. Early morning overtime (before shift standard in time)
  const earlyOtMins = (inMins !== null && inMins < shiftInMins) ? (shiftInMins - inMins) : 0;

  const totalOtMins = lateOtMins + earlyOtMins;
  if (totalOtMins > 0) {
    otHours = Math.round((totalOtMins / 60) * 2) / 2;
  }

  return { isLate, lateMinutes, otHours };
}

/**
 * Get status label and badges in Bengali
 */
export function getAttendanceStatusBadge(status: AttendanceStatus, dateStr?: string, otHours?: number) {
  if (dateStr && isFriday(dateStr)) {
    if (typeof otHours === 'number' && otHours > 0) {
      return {
        label: 'শুক্রবার (শুধু ওটি)',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-300',
        dotClass: 'bg-indigo-500',
      };
    }
    return {
      label: 'শুক্রবার (বন্ধ)',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
      dotClass: 'bg-slate-500',
    };
  }
  switch (status) {
    case 'present':
      return {
        label: 'উপস্থিত',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300',
        dotClass: 'bg-emerald-500',
      };
    case 'late':
      return {
        label: 'বিলম্ব / লেট',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-300',
        dotClass: 'bg-amber-500',
      };
    case 'absent':
      return {
        label: 'অনুপস্থিত',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-300',
        dotClass: 'bg-rose-500',
      };
    case 'half_day':
      return {
        label: 'অর্ধ-দিবস',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-300',
        dotClass: 'bg-indigo-500',
      };
    case 'leave':
      return {
        label: 'ছুটিতে',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-300',
        dotClass: 'bg-blue-500',
      };
    case 'holiday':
      return {
        label: 'ছুটি / বন্ধ',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
        dotClass: 'bg-slate-500',
      };
    default:
      return {
        label: 'উপস্থিত',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300',
        dotClass: 'bg-emerald-500',
      };
  }
}

/**
 * Normalizes worker ID / employee ID by converting Bengali digits to English,
 * trimming, and lowercasing for consistent comparisons across modules.
 */
export function normalizeWorkerId(id?: string | number): string {
  if (id === null || id === undefined) return '';
  const str = String(id).trim();
  const bnToEnMap: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  };
  return str.replace(/[০-৯]/g, (d) => bnToEnMap[d] || d).toLowerCase();
}

/**
 * Normalizes any date string (e.g. "2026-03-20", "২০২৬-০৩-২০", "20/03/2026", ISO string)
 * to standard "YYYY-MM-DD". Returns null if unparseable.
 */
export function normalizeDateToStandard(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const enStr = toEnglishNumber(dateStr).trim().split('T')[0].split(' ')[0];
  const delim = enStr.includes('/') ? '/' : '-';
  const parts = enStr.split(delim);
  if (parts.length < 3) return null;

  // Case 1: YYYY-MM-DD
  if (parts[0].length === 4) {
    const y = parts[0];
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // Case 2: DD-MM-YYYY
  if (parts[2].length === 4) {
    const y = parts[2];
    const m = parts[1].padStart(2, '0');
    const d = parts[0].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

/**
 * Compute total attendance statistics for an employee across all or a filtered period
 */
export function calculateEmployeeAttendanceStats(
  employeeId: string,
  records: AttendanceRecord[],
  filterMonth?: string, // e.g. "জানুয়ারি", "ফেব্রুয়ারি" etc. or 'all'
  filterYear?: number | string, // e.g. 2026 or 'all' or undefined
  workerId?: string,
  employeeName?: string,
  joinDate?: string
): EmployeeAttendanceStats {
  const BENGALI_MONTHS = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];

  const normEmpWId = normalizeWorkerId(workerId);
  const normEmpId = normalizeWorkerId(employeeId);
  const trimmedEmpName = employeeName ? employeeName.trim().toLowerCase() : '';
  const cleanJoinDate = normalizeDateToStandard(joinDate);

  const empRecords = records.filter((r) => {
    if (!r) return false;
    const normRecWId = normalizeWorkerId(r.workerId);
    const normRecEId = normalizeWorkerId(r.employeeId);
    const trimmedRecName = r.employeeName ? r.employeeName.trim().toLowerCase() : '';

    const isMatch =
      // Direct raw matches
      (r.employeeId && (r.employeeId === employeeId || (workerId && r.employeeId === workerId))) ||
      (r.workerId && ((workerId && r.workerId === workerId) || r.workerId === employeeId)) ||
      // Normalized ID matches (e.g. '০৯' vs '09' vs '9')
      (normEmpWId && (normRecWId === normEmpWId || normRecEId === normEmpWId || normRecWId.replace(/^0+/, '') === normEmpWId.replace(/^0+/, ''))) ||
      (normEmpId && (normRecEId === normEmpId || normRecWId === normEmpId || normRecWId.replace(/^0+/, '') === normEmpId.replace(/^0+/, ''))) ||
      // Name match
      (trimmedEmpName && trimmedRecName && trimmedRecName === trimmedEmpName);

    if (!isMatch) return false;
    if (!r.date) return false;

    // কারখানা অ্যাপ চালুর শুরুর তারিখ (১লা অক্টোবর ২০২৬) এর পূর্বের কোনো রেকর্ড থাকবে না
    if (r.date < FACTORY_APP_START_DATE) return false;

    // নতুন কর্মী নীতি: যোগদানের আগের কোনো তারিখের রেকর্ড শ্রমিকের অনুপস্থিতি বা হিসাবে অন্তর্ভুক্ত হবে না
    if (cleanJoinDate && r.date < cleanJoinDate) return false;

    if (filterYear && filterYear !== 'all') {
      const enYear = toEnglishNumber(filterYear);
      if (!r.date.startsWith(`${enYear}`)) return false;
    }
    if (filterMonth && filterMonth !== 'all') {
      const parts = r.date.split('-');
      if (parts.length >= 2) {
        const monthNum = parseInt(parts[1], 10);
        const monthName = BENGALI_MONTHS[monthNum - 1];
        if (monthName !== filterMonth) return false;
      }
    }
    return true;
  });

  // 1. Deduplicate records per date so each date is processed exactly once
  const dateMap = new Map<string, AttendanceRecord>();
  empRecords.forEach((r) => {
    const existing = dateMap.get(r.date);
    if (!existing) {
      dateMap.set(r.date, r);
    } else {
      // Pick the better record (has OT, or not absent, or newer updatedAt)
      const rOt = Number(r.otHours) || 0;
      const exOt = Number(existing.otHours) || 0;
      if (rOt > exOt) {
        dateMap.set(r.date, r);
      } else if (r.status !== 'absent' && existing.status === 'absent') {
        dateMap.set(r.date, r);
      } else if ((r.updatedAt || 0) > (existing.updatedAt || 0)) {
        dateMap.set(r.date, r);
      }
    }
  });
  const dedupedEmpRecords = Array.from(dateMap.values());

  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let halfDayCount = 0;
  let leaveCount = 0;
  let fridayOtHours = 0;
  let totalOtHours = 0;
  let fridayDutiesCount = 0;

  dedupedEmpRecords.forEach((r) => {
    const isFri = isFriday(r.date) || r.status === 'holiday' || getBengaliDayName(r.date) === 'শুক্রবার';

    // On Friday: Closed day / Weekly holiday!
    // শুক্রবার এ ot ঘণ্টার সাথে সাথে কখনোই সাধারণ হাজিরা যোগ হবে না। শুধু OT ঘণ্টা হিসাব হবে।
    if (isFri) {
      let ot = Number(r.otHours) || 0;
      // If duty hours entered (inTime and outTime)
      if (r.inTime && r.outTime) {
        const autoOt = calculateFridayOtHours(r.inTime, r.outTime);
        const inMins = timeStringToMinutes(r.inTime);
        const outMins = timeStringToMinutes(r.outTime);
        if (inMins !== null && outMins !== null && outMins > inMins) {
          const rawHours = Math.round(((outMins - inMins) / 60) * 2) / 2;
          // If ot was 0 or equal to un-deducted raw hours, ensure Friday break is applied
          if (ot === 0 || ot === rawHours) {
            ot = autoOt;
          }
        } else if (ot === 0) {
          ot = autoOt;
        }
      }
      if (ot > 0) {
        fridayOtHours += ot;
        totalOtHours += ot;
        fridayDutiesCount++;
      }
      // Note: On Friday, presentCount, absentCount, and lateCount are strictly NOT incremented!
    } else {
      if (r.status === 'present') {
        presentCount++;
      } else if (r.status === 'late') {
        // Note: A late person on regular work day is present, but late!
        presentCount++;
        lateCount++;
      } else if (r.status === 'absent') {
        absentCount++;
      } else if (r.status === 'half_day') {
        halfDayCount++;
        presentCount += 0.5;
      } else if (r.status === 'leave') {
        leaveCount++;
      }

      if (r.otHours && r.otHours > 0) {
        totalOtHours += Number(r.otHours);
      }
    }
  });

  const totalRecords = dedupedEmpRecords.length;

  // কারখানার অফিস ডে / কর্মদিবস হিসাব (স্ট্যান্ডার্ড ২৬ দিন)
  let totalOfficeDays = 26;
  if (filterMonth && filterMonth !== 'all') {
    // নির্দিষ্ট কোনো মাসের ক্ষেত্রে কারখানার সার্বজনীন অফিস ডে হলো স্ট্যান্ডার্ড ২৬ দিন
    totalOfficeDays = 26;
  } else {
    // সব মাস নির্বাচিত থাকলে স্বতন্ত্র মাসের গুণিতক হিসেবে ২৬ দিন
    const uniqueMonths = new Set(dedupedEmpRecords.map((r) => r.date.substring(0, 7)));
    totalOfficeDays = Math.max(1, uniqueMonths.size) * 26;
  }

  // Calculate attendance percentage based on total recorded working days (excluding official leaves/holidays)
  const workingDaysTracked = presentCount + absentCount;
  const attendanceRate = workingDaysTracked > 0 
    ? Math.round((presentCount / workingDaysTracked) * 100) 
    : (totalRecords > 0 ? 100 : 0);

  const regularOtHours = Math.max(0, Math.round((totalOtHours - fridayOtHours) * 10) / 10);

  return {
    totalRecords,
    totalOfficeDays,
    presentCount: Math.round(presentCount * 10) / 10,
    absentCount,
    lateCount,
    halfDayCount,
    leaveCount,
    fridayOtHours: Math.round(fridayOtHours * 10) / 10,
    regularOtHours,
    fridayDutiesCount,
    totalOtHours: Math.round(totalOtHours * 10) / 10,
    attendanceRate,
  };
}

/**
 * Factory Penalty Calculation Rule (সমন্বিত লেট ও অনুপস্থিতি নীতি):
 * লেট ও অনুপস্থিতি মিলে প্রতি ৩ দিন কাউন্ট হলে ১ দিনের হাজিরা কাটা যাবে:
 * (যেমন: ১ দিন লেট + ২ দিন অনুপস্থিত = ৩ দিন → ১ দিন কাটা; বা ২ দিন লেট + ১ দিন অনুপস্থিত = ৩ দিন → ১ দিন কাটা;
 * বা ৩ দিন লেট = ১ দিন কাটা; বা ৩ দিন অনুপস্থিত = ১ দিন কাটা; বা ২ দিন লেট + ৪ দিন অনুপস্থিত = ৬ দিন → ২ দিন কাটা ইত্যাদি)
 * 
 * Formula:
 * combinedBreachDays = absentDays + lateDays
 * totalPenaltyDays = Math.floor(combinedBreachDays / 3)
 * কার্যকর বেতন হাজিরা দিন = Math.max(0, presentDays - totalPenaltyDays)
 */
export function calculateCombinedPenaltyDays(
  absentDays: number,
  lateDays: number = 0,
  isMidMonthJoiner: boolean = false
): {
  combinedBreachDays: number;
  totalPenaltyDays: number;
  absentPenaltyDays: number;
  latePenaltyDays: number;
} {
  if (isMidMonthJoiner) {
    return { combinedBreachDays: 0, totalPenaltyDays: 0, absentPenaltyDays: 0, latePenaltyDays: 0 };
  }

  const cleanAbsent = Math.max(0, absentDays || 0);
  const cleanLate = Math.max(0, lateDays || 0);
  const combinedBreachDays = cleanAbsent + cleanLate;
  const totalPenaltyDays = Math.floor(combinedBreachDays / 3);

  // Distribute totalPenaltyDays cleanly between absentPenaltyDays and latePenaltyDays
  // ensuring absentPenaltyDays + latePenaltyDays === totalPenaltyDays
  let absentPenaltyDays = Math.floor(cleanAbsent / 3);
  let latePenaltyDays = Math.floor(cleanLate / 3);
  const remaining = totalPenaltyDays - (absentPenaltyDays + latePenaltyDays);

  if (remaining > 0) {
    const absentRem = cleanAbsent % 3;
    const lateRem = cleanLate % 3;
    if (absentRem >= lateRem) {
      absentPenaltyDays += remaining;
    } else {
      latePenaltyDays += remaining;
    }
  }

  return {
    combinedBreachDays,
    totalPenaltyDays,
    absentPenaltyDays,
    latePenaltyDays,
  };
}

export function calculateFactoryAttendanceDeduction(
  totalDays: number,
  presentDays: number,
  absentDays: number,
  lateDays: number = 0,
  applyFactoryRules: boolean = true,
  isNewJoinerMidMonth: boolean = false
) {
  if (!applyFactoryRules || isNewJoinerMidMonth) {
    return {
      absentPenaltyDays: 0,
      latePenaltyDays: 0,
      totalPenaltyDays: 0,
      totalDeductionDays: 0,
      effectivePresentDays: presentDays,
      combinedBreachDays: 0,
    };
  }

  const { combinedBreachDays, totalPenaltyDays, absentPenaltyDays, latePenaltyDays } =
    calculateCombinedPenaltyDays(absentDays, lateDays, isNewJoinerMidMonth);

  // মোট কর্তন দিন = আসল অনুপস্থিত দিন + সমন্বিত জরিমানা কর্তন
  const totalDeductionDays = Math.max(0, absentDays || 0) + totalPenaltyDays;
  // কার্যকর প্রদেয় হাজিরা দিন (উপস্থিত দিন থেকে সমন্বিত জরিমানা বাদ)
  const effectivePresentDays = Math.max(0, presentDays - totalPenaltyDays);

  return {
    absentPenaltyDays,
    latePenaltyDays,
    totalPenaltyDays,
    totalDeductionDays,
    effectivePresentDays,
    combinedBreachDays,
  };
}

/**
 * Helper to check if an employee is a mid-month new joiner for a specific salary month and year.
 * Rules:
 * 1. If employee joined mid-month (joinDay > 1, e.g. 15th, 20th etc.) in targetMonth & targetYear:
 *    - isNewJoinerMidMonth: true
 *    - Only actual present attendance is counted (no absent or late penalty deductions).
 *    - No attendance bonus for this partial month (0 bonus).
 * 2. If employee joined on the 1st of the month (joinDay === 1):
 *    - isNewJoinerMidMonth: false, isFirstDayJoiner: true
 *    - Standard full-month rules apply (attendance bonus, absent & late penalties as normal).
 * 3. In subsequent months (পরবর্তী মাস থেকে):
 *    - isNewJoinerMidMonth: false, isSubsequentMonth: true
 *    - Standard full-month rules apply (regular attendance bonus & penalties).
 */
export function getNewJoinerSalaryPolicy(
  joinDate?: string,
  targetMonth?: string, // e.g. "জানুয়ারি", "ফেব্রুয়ারি", "March", "03" etc.
  targetYear?: number | string // e.g. 2026 or "২০২৬"
): {
  isNewJoinerMidMonth: boolean;
  joinDay: number;
  joinMonthName: string;
  joinYear: number;
  isFirstDayJoiner: boolean;
  isSubsequentMonth: boolean;
  policyNote: string;
} {
  const BENGALI_MONTHS = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];
  const ENGLISH_MONTHS = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];

  if (!joinDate || !targetMonth || !targetYear) {
    return {
      isNewJoinerMidMonth: false,
      joinDay: 1,
      joinMonthName: '',
      joinYear: 0,
      isFirstDayJoiner: false,
      isSubsequentMonth: false,
      policyNote: '',
    };
  }

  try {
    const stdJoinDate = normalizeDateToStandard(joinDate);
    if (!stdJoinDate) {
      return {
        isNewJoinerMidMonth: false,
        joinDay: 1,
        joinMonthName: '',
        joinYear: 0,
        isFirstDayJoiner: false,
        isSubsequentMonth: false,
        policyNote: '',
      };
    }

    const [yStr, mStr, dStr] = stdJoinDate.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const d = parseInt(dStr, 10);

    if (isNaN(y) || isNaN(m) || isNaN(d) || m < 1 || m > 12) {
      return {
        isNewJoinerMidMonth: false,
        joinDay: 1,
        joinMonthName: '',
        joinYear: 0,
        isFirstDayJoiner: false,
        isSubsequentMonth: false,
        policyNote: '',
      };
    }

    const joinMonthName = BENGALI_MONTHS[m - 1];

    // Normalize targetYear (handles English number or Bengali digits)
    const targetYNum = parseInt(toEnglishNumber(targetYear), 10);
    if (isNaN(targetYNum)) {
      return {
        isNewJoinerMidMonth: false,
        joinDay: d,
        joinMonthName,
        joinYear: y,
        isFirstDayJoiner: false,
        isSubsequentMonth: false,
        policyNote: '',
      };
    }

    // Resolve targetMonthIndex (0-11)
    let targetMonthIndex = -1;
    const cleanTargetMonth = String(targetMonth).trim().toLowerCase();

    // Check Bengali month name
    targetMonthIndex = BENGALI_MONTHS.indexOf(targetMonth.trim());

    // If not found, check English month name
    if (targetMonthIndex === -1) {
      targetMonthIndex = ENGLISH_MONTHS.indexOf(cleanTargetMonth);
    }
    // If not found, check numeric month e.g. "3" or "03"
    if (targetMonthIndex === -1) {
      const numM = parseInt(toEnglishNumber(cleanTargetMonth), 10);
      if (!isNaN(numM) && numM >= 1 && numM <= 12) {
        targetMonthIndex = numM - 1;
      }
    }

    if (targetMonthIndex === -1) {
      return {
        isNewJoinerMidMonth: false,
        joinDay: d,
        joinMonthName,
        joinYear: y,
        isFirstDayJoiner: false,
        isSubsequentMonth: false,
        policyNote: '',
      };
    }

    const joinMonthIndex = m - 1;
    const isSameYear = y === targetYNum;
    const isSameMonth = targetMonthIndex === joinMonthIndex;

    // Check if salary is for the exact joining month
    if (isSameYear && isSameMonth) {
      if (d > 1) {
        return {
          isNewJoinerMidMonth: true,
          joinDay: d,
          joinMonthName,
          joinYear: y,
          isFirstDayJoiner: false,
          isSubsequentMonth: false,
          policyNote: `নতুন কর্মী (${d} ${joinMonthName} ${y} এ যোগদান): খণ্ডিত মাসে যোগদানের কারণে শুধুমাত্র উপস্থিত কার্যদিবসের হাজিরা গণনা হবে, কোনো লেট কর্তন বা অনুপস্থিতি জরিমানা হবে না এবং এ মাসে হাজিরা বোনাস প্রযোজ্য নয়। পরবর্তী মাস থেকে নিয়মিত সব নিয়ম প্রযোজ্য হবে।`,
        };
      } else {
        return {
          isNewJoinerMidMonth: false,
          joinDay: 1,
          joinMonthName,
          joinYear: y,
          isFirstDayJoiner: true,
          isSubsequentMonth: false,
          policyNote: `১ তারিখে যোগদানকারী কর্মী: পূর্ণ মাসের নিয়মিত কর্মচারী হিসেবে হাজিরা বোনাস, লেট কর্তন ও কারখানার সাধারণ সকল নিয়মাবলি প্রযোজ্য।`,
        };
      }
    }

    // Check if target month is after joining month (পরবর্তী মাস থেকে)
    const isAfterJoinMonth =
      targetYNum > y || (targetYNum === y && targetMonthIndex > joinMonthIndex);

    return {
      isNewJoinerMidMonth: false,
      joinDay: d,
      joinMonthName,
      joinYear: y,
      isFirstDayJoiner: false,
      isSubsequentMonth: isAfterJoinMonth,
      policyNote: isAfterJoinMonth
        ? `পরবর্তী মাস: কর্মী হিসেবে নিয়মিত সকল নিয়ম (হাজিরা বোনাস, লেট কর্তন ইত্যাদি) প্রযোজ্য।`
        : `কর্মী কারখানায় যোগদানের পূর্ববর্তী মাস।`,
    };
  } catch {
    return {
      isNewJoinerMidMonth: false,
      joinDay: 1,
      joinMonthName: '',
      joinYear: 0,
      isFirstDayJoiner: false,
      isSubsequentMonth: false,
      policyNote: '',
    };
  }
}
