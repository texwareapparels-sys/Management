import React, { useState, useRef } from 'react';
import { Employee, AttendanceRecord, SalaryDisbursementRecord, SalaryProgressStatus } from '../types';
import {
  calculateEmployeeAttendanceStats,
  getAttendanceStatusBadge,
  formatTime12h,
  coerceTimePeriod,
  getTodayDateString,
  calculateAttendanceMetrics,
  DEFAULT_SHIFT_SETTINGS,
  normalizeWorkerId,
  calculateFridayBreakDeductionMinutes,
  timeStringToMinutes,
  isFriday,
  getBengaliDayName,
  calculateFactoryAttendanceDeduction,
  getNewJoinerSalaryPolicy
} from '../lib/attendanceUtils';
import { formatDateBn, toBengaliNumber, formatMoney } from '../lib/utils';
import { saveOrUpdateAttendanceRecord, subscribeSalaryRecords, updateSalaryProgressStatus } from '../lib/firebase';
import { printElement } from '../lib/printer';
import { WorkerNoticeModal } from './WorkerNoticeModal';
import {
  Calendar,
  Clock,
  UserCheck,
  UserX,
  AlertTriangle,
  Sparkles,
  Coffee,
  CheckCircle2,
  PlusCircle,
  Check,
  History,
  Info,
  Printer,
  Calculator,
  Bell,
  RefreshCw,
  Send,
  DollarSign
} from 'lucide-react';

interface EmployeeAttendanceProfileViewProps {
  employee: Employee;
  records: AttendanceRecord[];
  employees?: Employee[];
  showToast?: (msg: string) => void;
  allowQuickMark?: boolean;
}

const BENGALI_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

export const EmployeeAttendanceProfileView: React.FC<EmployeeAttendanceProfileViewProps> = ({
  employee,
  records,
  showToast,
  allowQuickMark = true,
}) => {
  const individualPrintRef = useRef<HTMLDivElement>(null);
  const currentMonthIdx = new Date().getMonth();
  const currentYearNum = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState<string>(BENGALI_MONTHS[currentMonthIdx]);
  const [selectedYear, setSelectedYear] = useState<number | string>(currentYearNum);

  const isRecordForEmployee = (r: AttendanceRecord) => {
    if (!r) return false;
    if (r.employeeId && employee.id && r.employeeId === employee.id) return true;
    if (employee.workerId && (r.workerId === employee.workerId || r.employeeId === employee.workerId)) return true;
    if (employee.id && (r.workerId === employee.id || r.employeeId === employee.id)) return true;

    const normEmpWId = normalizeWorkerId(employee.workerId);
    const normRecWId = normalizeWorkerId(r.workerId);
    const normRecEId = normalizeWorkerId(r.employeeId);
    const normEmpId = normalizeWorkerId(employee.id);

    if (normEmpWId) {
      if (normRecWId && (normRecWId === normEmpWId || normRecWId.replace(/^0+/, '') === normEmpWId.replace(/^0+/, ''))) return true;
      if (normRecEId && (normRecEId === normEmpWId || normRecEId.replace(/^0+/, '') === normEmpWId.replace(/^0+/, ''))) return true;
    }
    if (normEmpId) {
      if (normRecEId && normRecEId === normEmpId) return true;
      if (normRecWId && (normRecWId === normEmpId || normRecWId.replace(/^0+/, '') === normEmpId.replace(/^0+/, ''))) return true;
    }

    if (employee.name && r.employeeName && r.employeeName.trim() === employee.name.trim()) return true;
    return false;
  };

  // Quick mark attendance state for today
  const [showQuickMark, setShowQuickMark] = useState(false);
  const todayStr = getTodayDateString();
  const existingTodayRec = records.find(
    (r) => isRecordForEmployee(r) && r.date === todayStr
  );

  const [quickStatus, setQuickStatus] = useState<AttendanceRecord['status']>(
    existingTodayRec?.status || 'present'
  );
  const [quickInTime, setQuickInTime] = useState<string>(
    existingTodayRec?.inTime || '08:00'
  );
  const [quickOutTime, setQuickOutTime] = useState<string>(
    existingTodayRec?.outTime || '17:00'
  );
  const [quickOtHours, setQuickOtHours] = useState<number>(
    typeof existingTodayRec?.otHours === 'number' ? existingTodayRec.otHours : 0
  );
  const [quickNote, setQuickNote] = useState<string>(existingTodayRec?.note || '');
  const [isSaving, setIsSaving] = useState(false);

  // Salary & Notice States
  const [salaryRecords, setSalaryRecords] = useState<SalaryDisbursementRecord[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [showStatusPanel, setShowStatusPanel] = useState(false);

  React.useEffect(() => {
    const unsub = subscribeSalaryRecords((data) => {
      setSalaryRecords(data);
    });
    return () => unsub();
  }, []);

  const currentCalMonth = selectedMonth === 'all' ? BENGALI_MONTHS[currentMonthIdx] : selectedMonth;
  const currentCalYear = selectedYear === 'all' ? new Date().getFullYear() : Number(selectedYear);

  const matchedSalaryRecord = salaryRecords.find(
    (r) =>
      (r.employeeId === employee.id || r.workerId === employee.workerId) &&
      r.month === currentCalMonth &&
      r.year === currentCalYear
  );

  const [statusVal, setStatusVal] = useState<SalaryProgressStatus>(
    matchedSalaryRecord?.progressStatus || 'due'
  );
  const [statusDate, setStatusDate] = useState<string>(
    matchedSalaryRecord?.statusUpdatedDate || getTodayDateString()
  );
  const [statusNote, setStatusNote] = useState<string>(
    matchedSalaryRecord?.note || ''
  );

  React.useEffect(() => {
    if (matchedSalaryRecord) {
      setStatusVal(
        matchedSalaryRecord.progressStatus ||
          (matchedSalaryRecord.paymentStatus === 'paid' ? 'disbursed' : 'due')
      );
      setStatusDate(matchedSalaryRecord.statusUpdatedDate || getTodayDateString());
      setStatusNote(matchedSalaryRecord.note || '');
    } else {
      setStatusVal('due');
      setStatusDate(getTodayDateString());
      setStatusNote('');
    }
  }, [matchedSalaryRecord, currentCalMonth, currentCalYear]);

  // Compute stats
  const stats = calculateEmployeeAttendanceStats(
    employee.id,
    records,
    selectedMonth,
    selectedYear,
    employee.workerId,
    employee.name
  );

  // Filter individual logs for the history table
  const employeeLogs = records
    .filter((r) => {
      if (!isRecordForEmployee(r)) return false;
      if (selectedYear && selectedYear !== 'all' && !r.date.startsWith(`${selectedYear}`)) return false;
      if (selectedMonth && selectedMonth !== 'all') {
        const parts = r.date.split('-');
        if (parts.length >= 2) {
          const mIdx = parseInt(parts[1], 10) - 1;
          if (BENGALI_MONTHS[mIdx] !== selectedMonth) return false;
        }
      }
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const handlePrintIndividualAttendance = () => {
    if (individualPrintRef.current) {
      const safeName = (employee.name || 'Worker').replace(/\s+/g, '_');
      printElement(
        individualPrintRef.current,
        `Attendance_History_${employee.workerId || 'Worker'}_${safeName}`,
        'sheet'
      );
    } else {
      window.print();
    }
  };

  const handleSaveQuickAttendance = async () => {
    setIsSaving(true);
    const metrics = calculateAttendanceMetrics(quickInTime, quickOutTime, DEFAULT_SHIFT_SETTINGS, todayStr);
    let finalStatus = quickStatus;
    if (isFriday(todayStr)) {
      finalStatus = 'holiday';
    } else if (finalStatus === 'present' && metrics.isLate) {
      finalStatus = 'late';
    }

    const finalOt = finalStatus === 'absent' || finalStatus === 'leave'
      ? 0
      : (typeof quickOtHours === 'number' ? quickOtHours : metrics.otHours);

    try {
      await saveOrUpdateAttendanceRecord({
        employeeId: employee.id,
        workerId: employee.workerId,
        employeeName: employee.name,
        department: employee.department || '',
        date: todayStr,
        status: finalStatus,
        inTime: quickInTime || '08:00',
        outTime: quickOutTime || '17:00',
        shiftStart: DEFAULT_SHIFT_SETTINGS.standardInTime,
        shiftEnd: DEFAULT_SHIFT_SETTINGS.standardOutTime,
        isLate: isFriday(todayStr) ? false : metrics.isLate,
        lateMinutes: isFriday(todayStr) ? 0 : metrics.lateMinutes,
        otHours: finalOt,
        note: quickNote || (isFriday(todayStr) && finalOt ? 'শুক্রবার ওটি ডিউটি' : ''),
      });

      if (showToast) {
        if (isFriday(todayStr)) {
          showToast(
            finalOt > 0
              ? `✓ ${employee.name}-এর শুক্রবারের ${finalOt} ঘণ্টা ওটি সংরক্ষিত হয়েছে (হাজিরা গণনা হয়নি)`
              : `✓ ${employee.name}-এর শুক্রবার সাপ্তাহিক ছুটি সংরক্ষিত হয়েছে`
          );
        } else {
          showToast(`✓ আজকের হাজিরা ও ${finalOt > 0 ? `${finalOt} ঘণ্টা ওটি` : ''} সফলভাবে সংরক্ষিত হয়েছে`);
        }
      }
      setShowQuickMark(false);
    } catch (e) {
      if (showToast) {
        showToast('হাজিরা সংরক্ষণে ব্যর্থ হয়েছে');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // 'হিসাব করুন' বাটন হ্যান্ডলার (Calculate and Finalize Salary & Attendance)
  const handleCalculateSalary = async () => {
    setIsCalculating(true);
    try {
      const targetM = currentCalMonth;
      const targetY = currentCalYear;

      const joinPolicy = getNewJoinerSalaryPolicy(employee.joinDate, targetM, targetY);
      const isMidMonthJoiner = joinPolicy.isNewJoinerMidMonth;

      const calcStats = calculateEmployeeAttendanceStats(
        employee.id,
        records,
        targetM,
        targetY,
        employee.workerId,
        employee.name,
        employee.joinDate
      );

      const totalDays = 26;
      let presentDays = 0;
      let absentDays = 0;
      let lateDays = 0;
      if (isMidMonthJoiner) {
        presentDays = calcStats.totalRecords > 0
          ? Math.min(totalDays, Math.round(calcStats.presentCount))
          : Math.max(1, Math.min(totalDays, totalDays - joinPolicy.joinDay + 1));
        absentDays = 0;
        lateDays = 0;
      } else {
        presentDays = Math.min(totalDays, Math.round(calcStats.presentCount));
        absentDays = calcStats.absentCount;
        lateDays = calcStats.lateCount;
      }

      const penalties = calculateFactoryAttendanceDeduction(totalDays, presentDays, absentDays, lateDays, true, isMidMonthJoiner);
      const effectivePresentDays = penalties.effectivePresentDays;
      const salary = Number(employee.salary || 0);
      const presentSalary = Math.round((salary / totalDays) * effectivePresentDays);
      const otHours = calcStats.totalOtHours;
      const otRate = Number(employee.otRate || 0);
      const otPay = Math.round(otHours * otRate);

      // Auto attendance bonus rule: অনুপস্থিত বা লেট করলে কোনো হাজিরা বোনাস পাবে না, নতুন কর্মীর খণ্ডিত মাসে বোনাস নেই
      const bonus = isMidMonthJoiner ? 0 : ((absentDays > 0 || lateDays > 0) ? 0 : 500);
      const advance = matchedSalaryRecord?.advance || 0;
      const deduction = matchedSalaryRecord?.deduction || 0;
      const netPayable = Math.max(0, presentSalary + otPay + bonus - advance - deduction);

      const today = getTodayDateString();
      await updateSalaryProgressStatus(
        employee,
        targetM,
        targetY,
        'calculated',
        today,
        `অ্যাডমিন কর্তৃক "হিসাব করুন" বোতাম চাপার মাধ্যমে হিসাব সম্পূর্ণ করা হয়েছে (${formatDateBn(today)})`,
        {
          presentDays,
          totalDays,
          absentDays,
          lateDays,
          absentPenaltyDays: penalties.absentPenaltyDays,
          latePenaltyDays: penalties.latePenaltyDays,
          effectivePresentDays,
          presentSalary,
          otHours,
          otRate,
          otPay,
          bonus,
          advance,
          deduction,
          netPayable,
        }
      );

      if (showToast) {
        showToast(`✓ ${employee.name}-এর ${targetM} ${targetY}-এর হিসাব সম্পূর্ণ হয়েছে! শ্রমিকের প্রোফাইলে স্ট্যাটাস: "হিসাব সম্পূর্ণ"`);
      }
    } catch (err) {
      console.error(err);
      if (showToast) showToast('বেতন হিসাব সম্পূর্ণ করতে ত্রুটি হয়েছে');
    } finally {
      setIsCalculating(false);
    }
  };

  // তারিখ অনুযায়ী স্ট্যাটাস আপডেট হ্যান্ডলার
  const handleSaveStatus = async () => {
    setIsUpdatingStatus(true);
    try {
      await updateSalaryProgressStatus(
        employee,
        currentCalMonth,
        currentCalYear,
        statusVal,
        statusDate || getTodayDateString(),
        statusNote
      );
      if (showToast) {
        showToast(`✓ ${employee.name}-এর ${currentCalMonth} মাসের বেতন স্ট্যাটাস সফলভাবে আপডেট হয়েছে!`);
      }
      setShowStatusPanel(false);
    } catch (err) {
      console.error(err);
      if (showToast) showToast('স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const statusBadgeInfo = (() => {
    switch (statusVal) {
      case 'calculated':
        return { label: 'হিসাব সম্পূর্ণ', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'ready':
        return { label: 'বেতন দেওয়ার জন্য প্রস্তুত', bg: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'disbursed':
        return { label: 'বেতন প্রদান করা সম্পূর্ণ', bg: 'bg-teal-100 text-teal-800 border-teal-300' };
      case 'due':
      case 'calculating':
      default:
        return { label: 'বাকী', bg: 'bg-rose-100 text-rose-800 border-rose-300' };
    }
  })();

  return (
    <div className="space-y-4 pt-2">
      {/* Attendance Header & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 rounded-xl border border-blue-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <span>হাজিরা ও ইন-আউট টাইম ড্যাশবোর্ড</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                Attendance Profile
              </span>
            </h4>
            <p className="text-[10px] text-slate-500">
              উপস্থিতি, লেট মিনিট, অনুপস্থিতি ও অর্জিত ওভারটাইম রিপোর্ট
            </p>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none cursor-pointer shadow-xs"
          >
            <option value="all">সর্বমোট (All Time)</option>
            {BENGALI_MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none cursor-pointer shadow-xs"
          >
            <option value="all">সকল বছর (All Years)</option>
            <option value={2026}>২০২৬</option>
            <option value={2025}>২০২৫</option>
            <option value={2024}>২০২৪</option>
          </select>

          {/* হিসাব করুন বাটন (Admin Calculate Button) */}
          <button
            type="button"
            onClick={handleCalculateSalary}
            disabled={isCalculating}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer active:scale-95 disabled:opacity-50 ring-2 ring-emerald-400/40"
            title={`${currentCalMonth} ${currentCalYear} মাসের বেতন ও হাজিরা হিসাব সম্পূর্ণ করতে এখানে চাপুন`}
          >
            <Calculator className="w-3.5 h-3.5 text-emerald-200" />
            <span>{isCalculating ? 'হিসাব হচ্ছে...' : 'হিসাব করুন'}</span>
          </button>

          {/* বেতন স্ট্যাটাস পরিবর্তন বাটন */}
          <button
            type="button"
            onClick={() => setShowStatusPanel(!showStatusPanel)}
            className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition cursor-pointer active:scale-95"
            title="তারিখ অনুযায়ী বেতনের অবস্থান ও স্ট্যাটাস আপডেট করুন"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{showStatusPanel ? 'স্ট্যাটাস বন্ধ' : 'বেতন স্ট্যাটাস'}</span>
          </button>

          {/* নোটিশ দিন বাটন */}
          <button
            type="button"
            onClick={() => setShowNoticeModal(true)}
            className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition cursor-pointer active:scale-95"
            title="এই শ্রমিককে নোটিশ পাঠান"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>নোটিশ দিন</span>
          </button>

          {/* Individual A4 Print Button */}
          <button
            type="button"
            onClick={handlePrintIndividualAttendance}
            className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow-xs transition cursor-pointer active:scale-95"
            title="এই শ্রমিকের ইন-আউট টাইম ও উপস্থিতির হিস্ট্রি A4 সাইজে প্রিন্ট করুন"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>A4 হিস্ট্রি প্রিন্ট</span>
          </button>

          {allowQuickMark && (
            <button
              type="button"
              onClick={() => setShowQuickMark(!showQuickMark)}
              className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{showQuickMark ? 'ফর্ম বন্ধ' : 'আজকের হাজিরা দিন'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Salary Progress Status & Calculation Summary Card */}
      <div className="p-3.5 bg-gradient-to-r from-emerald-50/70 via-teal-50/50 to-slate-50 border border-emerald-200 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-xs text-slate-900">
                  বেতনের অবস্থান ({currentCalMonth} {currentCalYear}):
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${statusBadgeInfo.bg}`}>
                  {statusBadgeInfo.label}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">
                আপডেট তারিখ: <span className="font-bold text-slate-700">{formatDateBn(statusDate)}</span>
                {matchedSalaryRecord?.note && ` • ${matchedSalaryRecord.note}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCalculateSalary}
              disabled={isCalculating}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>{isCalculating ? 'হিসাব সম্পন্ন হচ্ছে...' : 'হিসাব করুন (হিসাব সম্পূর্ণ)'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowStatusPanel(!showStatusPanel)}
              className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition cursor-pointer"
            >
              {showStatusPanel ? 'বাতিল' : 'স্ট্যাটাস পরিবর্তন'}
            </button>
          </div>
        </div>

        {/* Quick Numbers Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2 bg-white rounded-xl border border-emerald-100">
            <span className="text-[10px] text-slate-500 block">উপস্থিত দিন (হাজিরা):</span>
            <span className="font-black text-slate-900 font-mono">
              {toBengaliNumber(matchedSalaryRecord?.presentDays ?? stats.presentCount)} দিন
            </span>
          </div>
          <div className="p-2 bg-white rounded-xl border border-emerald-100">
            <span className="text-[10px] text-slate-500 block">ওভারটাইম (OT):</span>
            <span className="font-black text-indigo-700 font-mono">
              {toBengaliNumber(matchedSalaryRecord?.otHours ?? stats.totalOtHours)} ঘণ্টা
            </span>
          </div>
          <div className="p-2 bg-white rounded-xl border border-emerald-100">
            <span className="text-[10px] text-slate-500 block">হাজিরা বোনাস:</span>
            <span className={`font-black font-mono ${
              (matchedSalaryRecord?.bonus ?? ((stats.absentCount > 0 || stats.lateCount > 0) ? 0 : 500)) > 0
                ? 'text-emerald-700'
                : 'text-rose-600'
            }`}>
              {(matchedSalaryRecord?.bonus ?? ((stats.absentCount > 0 || stats.lateCount > 0) ? 0 : 500)) > 0
                ? '৳ ৫০০ (বোনাস প্রাপ্ত)'
                : '৳ ০ (অনুপস্থিত/লেট)'}
            </span>
          </div>
          <div className="p-2 bg-white rounded-xl border border-emerald-100">
            <span className="text-[10px] text-slate-500 block">নিট প্রদেয় বেতন:</span>
            <span className="font-black text-emerald-800 text-sm font-mono">
              ৳ {formatMoney(
                matchedSalaryRecord?.netPayable ??
                Math.round(
                  (((Number(employee.salary) || 0) / 26) * stats.presentCount) +
                  ((stats.totalOtHours || 0) * (Number(employee.otRate) || 0)) +
                  ((stats.absentCount > 0 || stats.lateCount > 0) ? 0 : 500)
                )
              )}
            </span>
          </div>
        </div>

        {/* Status Edit Drawer */}
        {showStatusPanel && (
          <div className="p-3 bg-white rounded-xl border border-purple-200 space-y-2.5 animate-in fade-in duration-200">
            <div className="text-xs font-bold text-purple-950 pb-1 border-b border-purple-100 flex items-center justify-between">
              <span>{employee.name}-এর বেতন অবস্থান ও স্ট্যাটাস আপডেট করুন:</span>
              <span className="text-[11px] text-purple-700 font-medium">তারিখ অনুযায়ী স্বয়ংক্রিয়ভাবে সংরক্ষিত হবে</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1">
                  নতুন স্ট্যাটাস নির্বাচন করুন:
                </label>
                <select
                  value={statusVal}
                  onChange={(e) => setStatusVal(e.target.value as SalaryProgressStatus)}
                  className="w-full p-2 border border-purple-300 rounded-xl bg-purple-50/50 font-bold text-slate-900 outline-none"
                >
                  <option value="due">বাকী</option>
                  <option value="calculated">হিসাব সম্পূর্ণ</option>
                  <option value="ready">বেতন দেওয়ার জন্য প্রস্তুত</option>
                  <option value="disbursed">বেতন প্রদান করা সম্পূর্ণ</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1">
                  আপডেট তারিখ (তারিখ অনুযায়ী):
                </label>
                <input
                  type="date"
                  value={statusDate}
                  onChange={(e) => setStatusDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl font-medium outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1">
                  মন্তব্য / বিবরণী (ঐচ্ছিক):
                </label>
                <input
                  type="text"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="যেমন: হিসাব যাচাই শেষে চূড়ান্ত করা হয়েছে"
                  className="w-full p-2 border border-slate-300 rounded-xl font-medium outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowStatusPanel(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleSaveStatus}
                disabled={isUpdatingStatus}
                className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isUpdatingStatus ? 'আপডেট হচ্ছে...' : 'স্ট্যাটাস সংরক্ষণ করুন'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Mark Popover / Box */}
      {showQuickMark && (
        <div className="p-3.5 bg-blue-50/90 border border-blue-200 rounded-xl space-y-3 shadow-xs">
          <div className="flex items-center justify-between text-xs font-black text-blue-950 pb-1 border-b border-blue-200">
            <span>আজকের হাজিরা ও টাইম এন্ট্রি ({formatDateBn(todayStr)})</span>
            <span className="text-[10px] font-normal text-blue-800">
              {employee.name} ({employee.workerId})
            </span>
          </div>

          {isFriday(todayStr) && (
            <div className="p-2 bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg text-xs font-bold flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
              <span>🕌 শুক্রবার সাপ্তাহিক বন্ধ: ডিউটি টাইম শুধু ওভারটাইম (OT) গণ্য হবে। দুপুর <b>১:০০টা থেকে ২:০০টা পর্যন্ত (১ ঘণ্টা)</b> নামাজের ও খাবারের বিরতি ওটি থেকে বাদ দিয়ে হিসাব করা হচ্ছে।</span>
              {quickInTime && quickOutTime && (() => {
                const inM = timeStringToMinutes(quickInTime);
                const outM = timeStringToMinutes(quickOutTime);
                if (inM !== null && outM !== null && outM > inM) {
                  const breakM = calculateFridayBreakDeductionMinutes(inM, outM);
                  if (breakM > 0) {
                    return (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-200 text-amber-950 border border-amber-300 shrink-0">
                        -১ঘ. বিরতি বাদ
                      </span>
                    );
                  }
                }
                return null;
              })()}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-1">স্ট্যাটাস:</label>
              {isFriday(todayStr) ? (
                <div className="p-2 bg-white border border-slate-300 rounded-lg font-bold text-indigo-800 text-xs">
                  🕌 শুক্রবার ওটি ডিউটি (শুধু ওটি)
                </div>
              ) : (
                <select
                  value={quickStatus}
                  onChange={(e) => setQuickStatus(e.target.value as any)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
                >
                  <option value="present">উপস্থিত</option>
                  <option value="late">লেট / বিলম্ব</option>
                  <option value="absent">অনুপস্থিত</option>
                  <option value="half_day">অর্ধ-দিবস</option>
                  <option value="leave">ছুটি</option>
                </select>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-1">ইন টাইম (IN):</label>
              <input
                type="time"
                value={quickInTime}
                onFocus={(e) => {
                  if (!e.currentTarget.value) {
                    const def = DEFAULT_SHIFT_SETTINGS.standardInTime;
                    e.currentTarget.value = def;
                    setQuickInTime(def);
                    const effOut = quickOutTime || DEFAULT_SHIFT_SETTINGS.standardOutTime;
                    const metrics = calculateAttendanceMetrics(def, effOut, DEFAULT_SHIFT_SETTINGS, todayStr);
                    setQuickOtHours(metrics.otHours);
                  }
                }}
                onChange={(e) => {
                  const raw = e.target.value;
                  const val = !quickInTime && raw ? coerceTimePeriod(raw, 'AM') : raw;
                  setQuickInTime(val);
                  const effOut = quickOutTime || DEFAULT_SHIFT_SETTINGS.standardOutTime;
                  const metrics = calculateAttendanceMetrics(val, effOut, DEFAULT_SHIFT_SETTINGS, todayStr);
                  setQuickOtHours(metrics.otHours);
                }}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-1">আউট টাইম (OUT):</label>
              <input
                type="time"
                value={quickOutTime}
                onFocus={(e) => {
                  if (!e.currentTarget.value) {
                    const def = DEFAULT_SHIFT_SETTINGS.standardOutTime;
                    e.currentTarget.value = def;
                    setQuickOutTime(def);
                    const effIn = quickInTime || DEFAULT_SHIFT_SETTINGS.standardInTime;
                    const metrics = calculateAttendanceMetrics(effIn, def, DEFAULT_SHIFT_SETTINGS, todayStr);
                    setQuickOtHours(metrics.otHours);
                  }
                }}
                onChange={(e) => {
                  const raw = e.target.value;
                  const val = !quickOutTime && raw ? coerceTimePeriod(raw, 'PM') : raw;
                  setQuickOutTime(val);
                  const effIn = quickInTime || DEFAULT_SHIFT_SETTINGS.standardInTime;
                  const metrics = calculateAttendanceMetrics(effIn, val, DEFAULT_SHIFT_SETTINGS, todayStr);
                  setQuickOtHours(metrics.otHours);
                }}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-bold text-indigo-900">ওটি ঘণ্টা (OT Hours):</label>
                <span className="text-[9px] text-indigo-600 font-semibold">{quickOtHours}h ওটি</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="16"
                  value={quickOtHours}
                  onChange={(e) => setQuickOtHours(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-16 p-2 bg-white border border-indigo-300 rounded-lg font-black text-indigo-900 text-center text-xs"
                />
                <button
                  type="button"
                  onClick={() => setQuickOtHours((prev) => Math.max(0, Math.round((prev + 1) * 10) / 10))}
                  className="px-1.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[10px] border border-indigo-200 cursor-pointer"
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => setQuickOtHours((prev) => Math.max(0, Math.round((prev + 2) * 10) / 10))}
                  className="px-1.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[10px] border border-indigo-200 cursor-pointer"
                >
                  +2
                </button>
                <button
                  type="button"
                  onClick={() => setQuickOtHours((prev) => Math.max(0, Math.round((prev + 3) * 10) / 10))}
                  className="px-1.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[10px] border border-indigo-200 cursor-pointer"
                >
                  +3
                </button>
              </div>
            </div>

            <div className="sm:col-span-4">
              <label className="block text-[10px] font-bold text-slate-700 mb-1">মন্তব্য (ঐচ্ছিক):</label>
              <input
                type="text"
                placeholder="যেমন: বিশেষ ডিউটি, ৩ ঘণ্টা অতিরিক্ত কাজ ইত্যাদি"
                value={quickNote}
                onChange={(e) => setQuickNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.preventDefault();
                }}
                autoComplete="off"
                className="w-full p-2 bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowQuickMark(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-300 transition cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveQuickAttendance}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              {isSaving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
            </button>
          </div>
        </div>
      )}

      {/* 6 Key Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
        {/* Factory Office Days */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="text-[10px] font-bold text-slate-500 flex items-center justify-between">
            <span>কারখানার অফিস ডে</span>
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-lg font-black text-slate-800 mt-1">
            {toBengaliNumber(stats.totalOfficeDays || 26)} <span className="text-[10px] font-semibold text-slate-400">দিন</span>
          </div>
          <div className="text-[9px] text-slate-400 mt-0.5">
            মাসিক স্ট্যান্ডার্ড ২৬ কর্মদিবস
          </div>
        </div>

        {/* Present Days */}
        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
          <div className="text-[10px] font-bold text-emerald-800 flex items-center justify-between">
            <span>মোট উপস্থিতি</span>
            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg font-black text-emerald-700 mt-1">
            {toBengaliNumber(stats.presentCount)} <span className="text-[10px] font-semibold text-emerald-600">দিন</span>
          </div>
          <div className="text-[9px] font-bold text-emerald-700/80 mt-0.5">
            {stats.attendanceRate}% উপস্থিতির হার
          </div>
        </div>

        {/* Late Days */}
        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
          <div className="text-[10px] font-bold text-amber-800 flex items-center justify-between">
            <span>বিলম্ব / লেট</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-lg font-black text-amber-700 mt-1">
            {toBengaliNumber(stats.lateCount)} <span className="text-[10px] font-semibold text-amber-600">বার</span>
          </div>
          <div className="text-[9px] text-amber-700/80 mt-0.5">
            নির্ধারিত সময়ের পরে
          </div>
        </div>

        {/* Absent Days */}
        <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl">
          <div className="text-[10px] font-bold text-rose-800 flex items-center justify-between">
            <span>মোট অনুপস্থিতি</span>
            <UserX className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-lg font-black text-rose-700 mt-1">
            {toBengaliNumber(stats.absentCount)} <span className="text-[10px] font-semibold text-rose-600">দিন</span>
          </div>
          <div className="text-[9px] text-rose-700/80 mt-0.5">
            বেতন কর্তন প্রযোজ্য
          </div>
        </div>

        {/* Leave & Half-Days */}
        <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
          <div className="text-[10px] font-bold text-blue-800 flex items-center justify-between">
            <span>ছুটি ও হাফ-ডে</span>
            <Coffee className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-lg font-black text-blue-700 mt-1">
            {toBengaliNumber(stats.leaveCount + stats.halfDayCount)} <span className="text-[10px] font-semibold text-blue-600">দিন</span>
          </div>
          <div className="text-[9px] text-blue-700/80 mt-0.5">
            ছুটি: {toBengaliNumber(stats.leaveCount)}, হাফ: {toBengaliNumber(stats.halfDayCount)}
          </div>
        </div>

        {/* Total OT */}
        <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl">
          <div className="text-[10px] font-bold text-indigo-800 flex items-center justify-between">
            <span>অর্জিত ওভারটাইম</span>
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-lg font-black text-indigo-700 mt-1">
            {toBengaliNumber(stats.totalOtHours)} <span className="text-[10px] font-semibold text-indigo-600">ঘণ্টা</span>
          </div>
          <div className="text-[9px] text-indigo-700/80 mt-0.5">
            হার: {employee.otRate} টাকা/ঘণ্টা {stats.fridayOtHours && stats.fridayOtHours > 0 ? `• শুক্র ওটি: ${toBengaliNumber(stats.fridayOtHours)}ঘ.` : ''}
          </div>
        </div>
      </div>

      {/* In-Time & Out-Time History Log */}
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>দৈনিক ইন-আউট টাইম ও উপস্থিতির হিস্ট্রি</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintIndividualAttendance}
              className="text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 cursor-pointer"
            >
              <Printer className="w-3 h-3" />
              <span>প্রিন্ট</span>
            </button>
            <span className="text-[10px] text-slate-500 font-semibold">
              {employeeLogs.length} টি রেকর্ড পাওয়া গেছে
            </span>
          </div>
        </div>

        <div className="max-h-60 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/60 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2">তারিখ ও বার</th>
                <th className="p-2">স্ট্যাটাস</th>
                <th className="p-2">ইন টাইম</th>
                <th className="p-2">আউট টাইম</th>
                <th className="p-2">বিলম্ব / লেট</th>
                <th className="p-2">ওটি ঘণ্টা</th>
                <th className="p-2">মন্তব্য</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employeeLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    নির্বাচিত ফিল্টারে কোনো হাজিরার রেকর্ড পাওয়া যায়নি
                  </td>
                </tr>
              ) : (
                employeeLogs.map((log) => {
                  const badge = getAttendanceStatusBadge(log.status, log.date, log.otHours);
                  const dayName = getBengaliDayName(log.date);
                  const isFri = isFriday(log.date);
                  return (
                    <tr key={log.id} className={`hover:bg-slate-50/60 transition ${isFri ? 'bg-indigo-50/30' : ''}`}>
                      <td className="p-2 font-bold text-slate-800 whitespace-nowrap">
                        {formatDateBn(log.date)} {dayName ? <span className="text-[10px] text-slate-500 font-normal">({dayName})</span> : ''}
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${badge.badgeClass}`}
                        >
                          <span className={`w-1 h-1 rounded-full ${badge.dotClass}`} />
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-2 font-semibold text-slate-800 whitespace-nowrap">
                        {formatTime12h(log.inTime)}
                      </td>
                      <td className="p-2 font-semibold text-slate-800 whitespace-nowrap">
                        {formatTime12h(log.outTime)}
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {!isFri && (log.isLate || log.lateMinutes) ? (
                          <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px]">
                            {log.lateMinutes} মিনিট
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {log.otHours && log.otHours > 0 ? (
                          <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 text-[10px]">
                            {log.otHours}h
                          </span>
                        ) : (
                          <span className="text-slate-400">০</span>
                        )}
                      </td>
                      <td className="p-2 text-slate-600 max-w-[140px] truncate text-[11px]">
                        {log.note || (isFri && log.otHours ? 'শুক্রবার ওটি ডিউটি' : '—')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* INDIVIDUAL WORKER IN-OUT & ATTENDANCE HISTORY A4 SHEET   */}
      {/* ======================================================== */}
      <div
        id="employeeIndividualAttendancePrintArea"
        ref={individualPrintRef}
        className="hidden print:block bg-white text-slate-900 p-6 font-sans max-w-4xl mx-auto"
      >
        {/* Header */}
        <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
          <h1 className="text-xl font-black tracking-tight text-slate-900">
            টেক্স ওয়ার অ্যাপারেলস
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            গার্মেন্টস অ্যান্ড নিটওয়্যার ম্যানুফ্যাকচারিং • শ্রমিক ইন-আউট টাইম ও ব্যক্তিগত হাজিরা খাতা
          </p>
          <div className="mt-2 inline-block px-3 py-1 bg-slate-100 rounded-md border border-slate-300 font-bold text-xs text-slate-800">
            ব্যক্তিগত হাজিরা ও ইন-আউট পাঞ্চ লগ — {selectedMonth === 'all' ? 'সর্বমোট হিস্ট্রি' : `${selectedMonth} ${selectedYear}`}
          </div>
        </div>

        {/* Worker Details Card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 border border-slate-300 rounded-lg text-xs mb-4">
          <div>
            <span className="text-slate-500 block text-[10px]">শ্রমিকের নাম:</span>
            <span className="font-bold text-slate-900">{employee.name}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Worker ID:</span>
            <span className="font-bold text-slate-900">{employee.workerId}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">পদবি ও বিভাগ:</span>
            <span className="font-bold text-slate-900">{employee.designation} ({employee.department || 'সাধারণ'})</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">মোবাইল নম্বর:</span>
            <span className="font-bold text-slate-900">{employee.mobile || '—'}</span>
          </div>
        </div>

        {/* Summary Metric Badges */}
        <div className="grid grid-cols-6 gap-2 text-center text-xs mb-4">
          <div className="p-2 border border-slate-200 bg-slate-50 rounded">
            <span className="block text-[10px] text-slate-500">অফিস ডে</span>
            <span className="font-black text-sm text-slate-800">{toBengaliNumber(stats.totalOfficeDays || 26)} দিন</span>
          </div>
          <div className="p-2 border border-emerald-200 bg-emerald-50 rounded">
            <span className="block text-[10px] text-emerald-800">উপস্থিতি</span>
            <span className="font-black text-sm text-emerald-700">{toBengaliNumber(stats.presentCount)}</span>
          </div>
          <div className="p-2 border border-rose-200 bg-rose-50 rounded">
            <span className="block text-[10px] text-rose-800">অনুপস্থিতি</span>
            <span className="font-black text-sm text-rose-700">{toBengaliNumber(stats.absentCount)}</span>
          </div>
          <div className="p-2 border border-amber-200 bg-amber-50 rounded">
            <span className="block text-[10px] text-amber-800">বিলম্ব/লেট</span>
            <span className="font-black text-sm text-amber-700">{toBengaliNumber(stats.lateCount)}</span>
          </div>
          <div className="p-2 border border-blue-200 bg-blue-50 rounded">
            <span className="block text-[10px] text-blue-800">ছুটি/হাফ</span>
            <span className="font-black text-sm text-blue-700">{toBengaliNumber(stats.leaveCount + stats.halfDayCount)}</span>
          </div>
          <div className="p-2 border border-indigo-200 bg-indigo-50 rounded">
            <span className="block text-[10px] text-indigo-800">মোট ওভারটাইম</span>
            <span className="font-black text-sm text-indigo-700">{toBengaliNumber(stats.totalOtHours)} ঘ.</span>
          </div>
        </div>

        {/* Table of Daily Logs */}
        <table className="w-full text-xs text-left border-collapse border border-slate-300 mb-6">
          <thead>
            <tr className="bg-slate-100 text-slate-800">
              <th className="border border-slate-300 p-1.5 text-center w-8">ক্র.</th>
              <th className="border border-slate-300 p-1.5">তারিখ ও বার</th>
              <th className="border border-slate-300 p-1.5 text-center">স্ট্যাটাস</th>
              <th className="border border-slate-300 p-1.5 text-center">ইন টাইম</th>
              <th className="border border-slate-300 p-1.5 text-center">আউট টাইম</th>
              <th className="border border-slate-300 p-1.5 text-center">বিলম্ব (লেট)</th>
              <th className="border border-slate-300 p-1.5 text-center">ওটি ঘণ্টা</th>
              <th className="border border-slate-300 p-1.5">মন্তব্য</th>
            </tr>
          </thead>
          <tbody>
            {employeeLogs.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-4 text-center text-slate-400">
                  কোনো হাজিরার রেকর্ড পাওয়া যায়নি
                </td>
              </tr>
            ) : (
              employeeLogs.map((log, idx) => {
                const badge = getAttendanceStatusBadge(log.status, log.date, log.otHours);
                const dayName = getBengaliDayName(log.date);
                const isFri = isFriday(log.date);
                return (
                  <tr key={log.id} className={isFri ? 'bg-indigo-50/40' : ''}>
                    <td className="border border-slate-300 p-1.5 text-center font-bold">{toBengaliNumber(idx + 1)}</td>
                    <td className="border border-slate-300 p-1.5 font-bold whitespace-nowrap">
                      {formatDateBn(log.date)} {dayName ? `(${dayName})` : ''}
                    </td>
                    <td className="border border-slate-300 p-1.5 text-center font-bold">
                      {badge.label}
                    </td>
                    <td className="border border-slate-300 p-1.5 text-center font-semibold">
                      {formatTime12h(log.inTime)}
                    </td>
                    <td className="border border-slate-300 p-1.5 text-center font-semibold">
                      {formatTime12h(log.outTime)}
                    </td>
                    <td className="border border-slate-300 p-1.5 text-center">
                      {!isFri && (log.isLate || log.lateMinutes) ? `${toBengaliNumber(log.lateMinutes || 0)} মিনিট` : '—'}
                    </td>
                    <td className="border border-slate-300 p-1.5 text-center font-bold text-indigo-700">
                      {log.otHours && log.otHours > 0 ? `${toBengaliNumber(log.otHours)} ঘণ্টা` : '০'}
                    </td>
                    <td className="border border-slate-300 p-1.5 text-slate-600 text-[11px]">
                      {log.note || (isFri && log.otHours ? 'শুক্রবার ওটি ডিউটি' : '—')}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-8 pt-10 text-center text-xs font-bold text-slate-800">
          <div className="border-t border-slate-700 pt-1.5">
            শ্রমিকের স্বাক্ষর
          </div>
          <div className="border-t border-slate-700 pt-1.5">
            লাইন সুপারভাইজার
          </div>
          <div className="border-t border-slate-700 pt-1.5">
            কারখানা কর্তৃপক্ষ / এইচআর
          </div>
        </div>
      </div>

      {/* Worker Notice Modal (শ্রমিককে ব্যক্তিগত বা সকল শ্রমিকের নোটিশ প্রেরণ) */}
      <WorkerNoticeModal
        isOpen={showNoticeModal}
        onClose={() => setShowNoticeModal(false)}
        employees={[employee]}
        initialSelectedEmployee={employee}
        showToast={showToast || (() => {})}
      />
    </div>
  );
};
