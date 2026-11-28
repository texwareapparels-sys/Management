import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Employee, SalaryCalculation, AttendanceRecord, SalaryDisbursementRecord, TelegramSettings, SMSSettings } from '../types';
import { formatMoney, formatDateBn, getStatusBadge, toBengaliNumber, toEnglishNumber } from '../lib/utils';
import { printElement } from '../lib/printer';
import { openInExternalBrowser, shareViaTelegram } from '../lib/telegram';
import {
  subscribeAttendanceRecords,
  subscribeSalaryRecords,
  saveOrUpdateSalaryRecord,
  loadTelegramSettings,
  saveTelegramSettings,
  loadSMSSettings,
  saveSMSSettings,
} from '../lib/firebase';
import { calculateEmployeeAttendanceStats, getNewJoinerSalaryPolicy, calculateCombinedPenaltyDays } from '../lib/attendanceUtils';
import { EmployeeAttendanceProfileView } from './EmployeeAttendanceProfileView';
import { ContractLetterModal } from './ContractLetterModal';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  Calculator,
  Printer,
  Download,
  FileImage,
  Share2,
  Calendar,
  Clock,
  DollarSign,
  User,
  CheckCircle2,
  AlertCircle,
  Receipt,
  UserX,
  ExternalLink,
  RotateCcw,
  AlertTriangle,
  Search,
  Send,
  MessageSquare,
  Settings,
  Sliders,
  Eye,
  EyeOff,
  Copy,
  History,
  FileSpreadsheet,
  FileText,
  X
} from 'lucide-react';

interface UserSalaryAppProps {
  employees: Employee[];
  onOpenResignationModal?: (emp: Employee) => void;
  onOpenResignationLetter?: (emp: Employee) => void;
  onOpenSuspensionNotice?: (emp: Employee) => void;
  onOpenTerminationNotice?: (emp: Employee) => void;
  showToast: (msg: string) => void;
}

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

export const UserSalaryApp: React.FC<UserSalaryAppProps> = ({
  employees,
  onOpenResignationModal,
  onOpenResignationLetter,
  onOpenSuspensionNotice,
  onOpenTerminationNotice,
  showToast,
}) => {
  const [selectedId, setSelectedId] = useState<string>('');
  const [employeeSearchText, setEmployeeSearchText] = useState<string>('');
  const [includeResigned, setIncludeResigned] = useState<boolean>(false);

  // Month
  const currentMonthIndex = new Date().getMonth();
  const [month, setMonth] = useState<string>(BENGALI_MONTHS[currentMonthIndex]);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  // Days
  const [totalDays, setTotalDays] = useState<number>(26);
  const [presentDays, setPresentDays] = useState<number>(26);
  const [absentDays, setAbsentDays] = useState<number>(0);
  const [lateDays, setLateDays] = useState<number>(0);

  // Overtime
  const [otHours, setOtHours] = useState<number>(0);

  // Extras
  const [attendanceBonus, setAttendanceBonus] = useState<number>(0);
  const [festivalBonus, setFestivalBonus] = useState<number>(0);
  const [advance, setAdvance] = useState<number>(0);
  const [deduction, setDeduction] = useState<number>(0);
  const [deductionReason, setDeductionReason] = useState<string>('');
  const [isResignationSettlement, setIsResignationSettlement] = useState<boolean>(false);

  // Calculation Result
  const [calculation, setCalculation] = useState<SalaryCalculation | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [showTelegramPrintModal, setShowTelegramPrintModal] = useState<boolean>(false);
  const [isWritingComment, setIsWritingComment] = useState<boolean>(false);

  // Prevent print shortcuts while writing comments or typing in inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea' || isWritingComment) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isWritingComment]);

  // Attendance integration state
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  // Salary records subscription for preventing duplicate entries and syncing pending calculations
  const [salaryRecords, setSalaryRecords] = useState<SalaryDisbursementRecord[]>([]);
  const [isAddedToPayBook, setIsAddedToPayBook] = useState<boolean>(false);
  const [isAddingToPayBook, setIsAddingToPayBook] = useState<boolean>(false);
  const [showNetPayableSummary, setShowNetPayableSummary] = useState<boolean>(true);

  // Auto SMS and Telegram Settings State
  const [tgSettings, setTgSettings] = useState<TelegramSettings>({ botToken: '', chatId: '' });
  const [smsSettings, setSmsSettings] = useState<SMSSettings>({
    apiUrl: 'https://api.bulksmsbd.net/api/smsapi',
    apiKey: '',
    senderId: 'TexWare',
    method: 'GET',
    keyParam: 'api_key',
    mobileParam: 'number',
    messageParam: 'message',
    senderParam: 'senderid',
  });
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showSmsModal, setShowSmsModal] = useState<boolean>(false);
  const [smsCustomMsg, setSmsCustomMsg] = useState<string>('');
  const [smsRecipientMobile, setSmsRecipientMobile] = useState<string>('');
  const [isSendingSms, setIsSendingSms] = useState<boolean>(false);
  const [isTestingTg, setIsTestingTg] = useState<boolean>(false);
  const [showTgTokenInput, setShowTgTokenInput] = useState<boolean>(false);

  // Attendance History Modal State
  const [showAttendanceHistoryModal, setShowAttendanceHistoryModal] = useState<boolean>(false);
  const [selectedHistoryEmpId, setSelectedHistoryEmpId] = useState<string>('');

  // Contract Letter Modal State
  const [contractLetterEmp, setContractLetterEmp] = useState<Employee | null>(null);

  // Load Auto SMS and Telegram settings on mount
  useEffect(() => {
    loadTelegramSettings().then(setTgSettings);
    loadSMSSettings().then(setSmsSettings);
  }, []);

  // Subscribe to attendance records
  useEffect(() => {
    const unsub = subscribeAttendanceRecords((records) => {
      setAttendanceRecords(records);
    });
    return () => unsub();
  }, []);

  // Subscribe to salary disbursement records
  useEffect(() => {
    const unsubSal = subscribeSalaryRecords((records) => {
      setSalaryRecords(records);
    });
    return () => unsubSal();
  }, []);

  const invoiceRef = useRef<HTMLDivElement>(null);

  const selectedEmployee = employees.find((e) => e.id === selectedId) || null;
  const targetEmpForHistory =
    employees.find((e) => e.id === (selectedHistoryEmpId || selectedId)) ||
    selectedEmployee ||
    employees[0] ||
    null;

  // Summary of all processed records for the selected month & year (Aggregated Calculation)
  const processedMonthRecords: SalaryDisbursementRecord[] = useMemo(() => {
    const enY = toEnglishNumber(year);
    return salaryRecords.filter(
      (r: SalaryDisbursementRecord) => r.month === month && String(toEnglishNumber(r.year)) === String(enY)
    );
  }, [salaryRecords, month, year]);

  const totalProcessedNetPayable = useMemo(() => {
    return processedMonthRecords.reduce((sum: number, r: SalaryDisbursementRecord) => sum + (r.netPayable || 0), 0);
  }, [processedMonthRecords]);

  const totalProcessedBasic = useMemo(() => {
    return processedMonthRecords.reduce((sum: number, r: SalaryDisbursementRecord) => sum + (r.salary || 0), 0);
  }, [processedMonthRecords]);

  const totalProcessedOt = useMemo(() => {
    return processedMonthRecords.reduce((sum: number, r: SalaryDisbursementRecord) => sum + (r.otPay || 0), 0);
  }, [processedMonthRecords]);

  const totalProcessedBonus = useMemo(() => {
    return processedMonthRecords.reduce((sum: number, r: SalaryDisbursementRecord) => sum + (r.bonus || 0), 0);
  }, [processedMonthRecords]);

  const totalProcessedDeduction = useMemo(() => {
    return processedMonthRecords.reduce((sum: number, r: SalaryDisbursementRecord) => sum + ((r.advance || 0) + (r.deduction || 0)), 0);
  }, [processedMonthRecords]);

  const totalProcessedPaid = useMemo(() => {
    return processedMonthRecords.reduce((sum: number, r: SalaryDisbursementRecord) => {
      const p = r.paymentStatus === 'paid' ? (r.netPayable || r.paidAmount || 0) : (r.paidAmount || 0);
      return sum + p;
    }, 0);
  }, [processedMonthRecords]);

  const totalProcessedDue = useMemo(() => {
    return processedMonthRecords.reduce((sum: number, r: SalaryDisbursementRecord) => {
      const isPaid = r.paymentStatus === 'paid';
      if (isPaid) return sum;
      const d = r.dueAmount !== undefined ? r.dueAmount : Math.max(0, (r.netPayable || 0) - (r.paidAmount || 0));
      return sum + d;
    }, 0);
  }, [processedMonthRecords]);

  // Compute attendance stats for the selected employee and current selected month/year
  const attendanceForMonth = selectedEmployee
    ? calculateEmployeeAttendanceStats(
        selectedEmployee.id,
        attendanceRecords,
        month,
        year,
        selectedEmployee.workerId,
        selectedEmployee.name,
        selectedEmployee.joinDate
      )
    : null;

  // Check if selected employee joined mid-month for the currently selected salary month/year
  const joinPolicy = useMemo(() => {
    return getNewJoinerSalaryPolicy(selectedEmployee?.joinDate, month, year);
  }, [selectedEmployee?.joinDate, month, year]);

  const handleApplyAttendanceToCalculator = () => {
    if (!attendanceForMonth) return;
    const pDays = Math.min(totalDays, Math.round(attendanceForMonth.presentCount));
    const aDays = attendanceForMonth.absentCount;
    const lDays = attendanceForMonth.lateCount;
    setPresentDays(pDays);
    setOtHours(attendanceForMonth.totalOtHours);

    if (joinPolicy.isNewJoinerMidMonth) {
      setAbsentDays(0);
      setLateDays(0);
      setAttendanceBonus(0);
      showToast(`হাজিরা খাতা থেকে নতুন কর্মীর (${joinPolicy.joinDay} তারিখ যোগদানের) তথ্য লোড হয়েছে। কোনো কর্তন হবে না, শুধু উপস্থিত হাজিরা প্রদেয়।`);
    } else {
      setAbsentDays(aDays);
      setLateDays(lDays);
      if (aDays > 0 || lDays > 0) {
        setAttendanceBonus(0);
      } else {
        setAttendanceBonus(500);
      }
      showToast(`হাজিরা খাতা থেকে ${month} মাসের তথ্য সফলভাবে লোড হয়েছে!`);
    }
  };

  // Filtered employees for dropdown and search
  const displayedEmployees = employees.filter((e) => {
    if (!includeResigned && e.status !== 'active') return false;
    if (employeeSearchText.trim()) {
      const q = employeeSearchText.toLowerCase();
      const match =
        e.name.toLowerCase().includes(q) ||
        e.workerId.toLowerCase().includes(q) ||
        (e.department && e.department.toLowerCase().includes(q)) ||
        (e.designation && e.designation.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  // Whenever selected employee or month/year changes, automatically pull attendance & overtime!
  useEffect(() => {
    if (!selectedEmployee) return;
    const stats = calculateEmployeeAttendanceStats(
      selectedEmployee.id,
      attendanceRecords,
      month,
      year,
      selectedEmployee.workerId,
      selectedEmployee.name,
      selectedEmployee.joinDate
    );
    if (joinPolicy.isNewJoinerMidMonth) {
      // খণ্ডিত মাসে নতুন কর্মী: কোনো লেট বা অনুপস্থিতি কর্তন নেই, হাজিরা বোনাস নেই
      if (stats.totalRecords > 0) {
        setPresentDays(Math.min(totalDays, Math.round(stats.presentCount)));
        setAbsentDays(0);
        setLateDays(0);
        setOtHours(stats.totalOtHours);
        setAttendanceBonus(0);
      } else {
        // If employee joined on e.g. 20th in a 30-day month, default working days remaining
        const estimatedPresent = Math.max(1, Math.min(totalDays, totalDays - joinPolicy.joinDay + 1));
        setPresentDays(estimatedPresent);
        setAbsentDays(0);
        setLateDays(0);
        setOtHours(0);
        setAttendanceBonus(0);
      }
    } else {
      if (stats.totalRecords > 0) {
        setPresentDays(Math.min(totalDays, Math.round(stats.presentCount)));
        setAbsentDays(stats.absentCount);
        setLateDays(stats.lateCount);
        setOtHours(stats.totalOtHours);
        // Auto attendance bonus: absent বা late থাকলে ০
        if (stats.absentCount > 0 || stats.lateCount > 0) {
          setAttendanceBonus(0);
        } else {
          setAttendanceBonus(500);
        }
      } else {
        setPresentDays(totalDays);
        setAbsentDays(0);
        setLateDays(0);
        setOtHours(0);
        setAttendanceBonus(0);
      }
    }
  }, [
    selectedEmployee?.id,
    selectedEmployee?.joinDate,
    selectedEmployee?.workerId,
    selectedEmployee?.name,
    month,
    year,
    attendanceRecords,
    totalDays,
    joinPolicy.isNewJoinerMidMonth,
    joinPolicy.joinDay
  ]);

  // Whenever selected employee changes, update settlement defaults
  useEffect(() => {
    if (selectedEmployee) {
      if (selectedEmployee.status === 'resigned') {
        setIsResignationSettlement(true);
      }
    }
  }, [selectedEmployee]);

  // Recalculate absent days whenever total or present days change (regular employees only)
  useEffect(() => {
    if (joinPolicy.isNewJoinerMidMonth) {
      // For mid-month new joiners, days before their joining date are NOT counted as unexcused absences!
      setAbsentDays(0);
      setLateDays(0);
      return;
    }
    const diff = Math.max(0, totalDays - presentDays);
    setAbsentDays(diff);
  }, [totalDays, presentDays, joinPolicy.isNewJoinerMidMonth]);

  const handleCalculate = async () => {
    if (!selectedEmployee) {
      showToast('অনুগ্রহ করে প্রথমে একজন কর্মচারী নির্বাচন করুন');
      return;
    }

    if (presentDays > totalDays) {
      showToast('উপস্থিত দিন মোট কার্যদিবসের বেশি হতে পারে না');
      return;
    }

    const salary = Number(selectedEmployee.salary || 0);
    const otRate = Number(selectedEmployee.otRate || 0);

    // Factory Attendance & Penalty Rules:
    // ১. নতুন কর্মীর খণ্ডিত মাসে যোগদান নীতি (joinDay > 1):
    //    শুধু হাজিরা ধরা হবে, কোনো কর্তন (লেট বা অনুপস্থিতি জরিমানা) হবে না এবং এ মাসে কোনো হাজিরা বোনাস থাকবে না!
    // ২. ১ তারিখে যোগদান বা পরবর্তী মাস:
    //    আগের মতোই লেট কর্তন, অনুপস্থিতি জরিমানা ও হাজিরা বোনাস নিয়মিত প্রযোজ্য।
    let absentPenaltyDays = 0;
    let latePenaltyDays = 0;
    let effectivePresentDays = presentDays;
    let autoBonus = 0;

    if (joinPolicy.isNewJoinerMidMonth) {
      absentPenaltyDays = 0;
      latePenaltyDays = 0;
      effectivePresentDays = presentDays;
      autoBonus = 0;
      if (attendanceBonus !== 0) {
        setAttendanceBonus(0);
      }
    } else {
      const penalties = calculateCombinedPenaltyDays(absentDays, lateDays, false);
      absentPenaltyDays = penalties.absentPenaltyDays;
      latePenaltyDays = penalties.latePenaltyDays;
      effectivePresentDays = Math.max(0, presentDays - penalties.totalPenaltyDays);
      autoBonus = (absentDays > 0 || (lateDays || 0) > 0) ? 0 : attendanceBonus;
      if (autoBonus !== attendanceBonus) {
        setAttendanceBonus(0);
      }
    }

    const presentSalary = totalDays > 0 ? (salary / totalDays) * effectivePresentDays : 0;
    const otPay = otHours * otRate;

    const totalAddition = presentSalary + otPay + autoBonus + festivalBonus;
    const totalDeduction = advance + deduction;
    const finalSalary = Math.max(0, Math.round(totalAddition - totalDeduction));

    const calc: SalaryCalculation = {
      employee: selectedEmployee,
      month,
      year,
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      absentPenaltyDays,
      latePenaltyDays,
      effectivePresentDays,
      salary,
      presentSalary: Math.round(presentSalary),
      otHours,
      otRate,
      otPay: Math.round(otPay),
      bonus: autoBonus + festivalBonus,
      advance,
      deduction,
      deductionReason,
      isResignationSettlement,
      isNewJoinerMidMonth: joinPolicy.isNewJoinerMidMonth,
      newJoinerNote: joinPolicy.policyNote,
      finalSalary,
      calculatedAt: Date.now(),
    };

    setCalculation(calc);
    setIsAddedToPayBook(false);

    showToast(
      joinPolicy.isNewJoinerMidMonth
        ? '✓ নতুন কর্মীর বেতন হিসাব সম্পন্ন হয়েছে (শুধু উপস্থিত হাজিরা, কোনো কর্তন নেই)'
        : 'বেতন হিসাব সম্পন্ন হয়েছে! নিচে "বেতন খাতায় যোগ করুন" বাটনে চাপুন।'
    );

    // Smooth scroll down to preview on small screens
    setTimeout(() => {
      invoiceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 150);
  };

  const handleAddToPayBook = async () => {
    if (!calculation || !selectedEmployee) {
      showToast('আগে বেতন হিসাব করুন');
      return;
    }

    setIsAddingToPayBook(true);
    try {
      const existing = salaryRecords.find(
        (r) =>
          (r.employeeId === selectedEmployee.id || (selectedEmployee.workerId && r.workerId === selectedEmployee.workerId)) &&
          r.month === month &&
          Number(r.year) === Number(year)
      );

      const recordId = existing?.id || `sal_${selectedEmployee.workerId || selectedEmployee.id}_${month}_${year}`;

      const salaryDisbursementData: Omit<SalaryDisbursementRecord, 'id'> = {
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        workerId: selectedEmployee.workerId,
        designation: selectedEmployee.designation,
        department: selectedEmployee.department || 'সাধারণ',
        month,
        year,
        salary: calculation.salary,
        totalDays: calculation.totalDays,
        presentDays: calculation.presentDays,
        absentDays: calculation.absentDays,
        lateDays: calculation.lateDays,
        absentPenaltyDays: calculation.absentPenaltyDays,
        latePenaltyDays: calculation.latePenaltyDays,
        effectivePresentDays: calculation.effectivePresentDays,
        presentSalary: calculation.presentSalary,
        otHours: calculation.otHours,
        otRate: calculation.otRate,
        otPay: calculation.otPay,
        bonus: calculation.bonus,
        advance: calculation.advance,
        deduction: calculation.deduction,
        deductionReason: calculation.deductionReason,
        netPayable: calculation.finalSalary,
        paidAmount: 0,
        dueAmount: calculation.finalSalary,
        paymentMethod: existing?.paymentMethod || 'cash',
        paymentStatus: 'pending',
        paidAt: Date.now(),
        note: calculation.isResignationSettlement ? 'পদত্যাগকালীন চূড়ান্ত নিষ্পত্তি' : existing?.note || '',
      };

      await saveOrUpdateSalaryRecord(salaryDisbursementData, recordId);
      setIsAddedToPayBook(true);

      showToast('✓ বেতন খাতায় সফলভাবে যোগ হয়েছে এবং স্ট্যাটাস পেন্ডিং করা হয়েছে');
    } catch (saveErr) {
      console.warn('Salary record save error:', saveErr);
      showToast('বেতন খাতায় যোগ করতে সমস্যা হয়েছে');
    } finally {
      setIsAddingToPayBook(false);
    }
  };

  /* ================= AUTO SMS & TELEGRAM HANDLERS ================= */
  const handleOpenSmsModal = () => {
    if (!calculation || !selectedEmployee) {
      showToast('আগে বেতন হিসাব করুন');
      return;
    }
    const mobile = selectedEmployee.mobile || '';
    setSmsRecipientMobile(mobile);
    const msg = `টেক্স ওয়ার অ্যাপারেলস: ${selectedEmployee.name} (আইডি: ${selectedEmployee.workerId || ''}), ${month} ${year}-এর নিট বেতন: ${formatMoney(calculation.finalSalary)} ৳। মোট দিন: ${calculation.totalDays}, উপস্থিতি: ${calculation.presentDays} দিন, ওটি: ${calculation.otHours}ঘ.।`;
    setSmsCustomMsg(msg);
    setShowSmsModal(true);
  };

  const handleSendSmsToEmployee = async () => {
    if (!smsRecipientMobile.trim()) {
      showToast('মোবাইল নম্বর লিখুন');
      return;
    }
    if (!smsCustomMsg.trim()) {
      showToast('মেসেজ লিখুন');
      return;
    }
    if (!smsSettings.apiKey || !smsSettings.apiUrl) {
      showToast('আগে BulkSMSBD API Key সেট করুন (সেটিংস বাটনে চাপুন)');
      setShowSettingsModal(true);
      return;
    }

    try {
      setIsSendingSms(true);
      let numberFormatted = smsRecipientMobile.replace(/\D/g, '');
      if (numberFormatted.startsWith('0')) {
        numberFormatted = '88' + numberFormatted;
      }
      const params = new URLSearchParams();
      params.set(smsSettings.keyParam || 'api_key', smsSettings.apiKey || '');
      params.set(smsSettings.mobileParam || 'number', numberFormatted);
      params.set(smsSettings.messageParam || 'message', smsCustomMsg.trim());
      if (smsSettings.senderId) {
        params.set(smsSettings.senderParam || 'senderid', smsSettings.senderId);
      }

      let res: Response;
      if (smsSettings.method === 'POST') {
        res = await fetch(smsSettings.apiUrl, {
          method: 'POST',
          body: params,
        });
      } else {
        const sep = smsSettings.apiUrl.includes('?') ? '&' : '?';
        res = await fetch(`${smsSettings.apiUrl}${sep}${params.toString()}`);
      }
      const txt = await res.text();
      showToast(`SMS পাঠানো সম্পন্ন: ${txt.substring(0, 35)}`);
      setShowSmsModal(false);
    } catch (err: any) {
      showToast(`SMS পাঠানো যায়নি: ${err.message || 'API Error'}`);
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleSendTelegramSalary = () => {
    if (!calculation || !selectedEmployee) {
      showToast('আগে বেতন হিসাব করুন');
      return;
    }
    const text =
      `📢 *টেক্স ওয়ার অ্যাপারেলস — বেতন স্লিপ*\n` +
      `👤 *কর্মী:* ${selectedEmployee.name} (${selectedEmployee.workerId})\n` +
      `📅 *মাস:* ${month} ${year}\n` +
      `💵 *মূল বেতন:* ${formatMoney(calculation.salary)} ৳\n` +
      `✅ *হাজিরা:* ${calculation.presentDays} দিন | *ওটি:* ${calculation.otHours} ঘণ্টা\n` +
      `💰 *নিট প্রদেয় বেতন:* ${formatMoney(calculation.finalSalary)} ৳\n` +
      `স্ট্যাটাস: ${isAddedToPayBook ? 'পেন্ডিং (হিসাব খাতায় যুক্ত)' : 'হিসাব সম্পন্ন'}`;

    if (tgSettings.botToken && tgSettings.chatId) {
      const url = `https://api.telegram.org/bot${encodeURIComponent(tgSettings.botToken.trim())}/sendMessage`;
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgSettings.chatId.trim(),
          text,
          parse_mode: 'Markdown',
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            showToast('✓ Telegram বটে বেতন স্লিপ সফলভাবে পাঠানো হয়েছে');
          } else {
            shareViaTelegram(text);
            showToast('টেলিগ্রাম শেয়ার স্ক্রিন ওপেন হয়েছে');
          }
        })
        .catch(() => {
          shareViaTelegram(text);
        });
    } else {
      shareViaTelegram(text);
    }
  };

  const handleSaveSettingsFromModal = async () => {
    await saveTelegramSettings(tgSettings);
    await saveSMSSettings(smsSettings);
    showToast('✓ Auto SMS ও Telegram সেটিংস সফলভাবে সংরক্ষিত হয়েছে');
    setShowSettingsModal(false);
  };

  const handleTestTelegramFromModal = async () => {
    if (!tgSettings.botToken || !tgSettings.chatId) {
      showToast('আগে Telegram Token ও Chat ID দিন');
      return;
    }
    try {
      setIsTestingTg(true);
      const url = `https://api.telegram.org/bot${encodeURIComponent(tgSettings.botToken.trim())}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgSettings.chatId.trim(),
          text: `🔔 টেক্স ওয়ার অ্যাপারেলস\nTelegram Notification টেস্ট সফল হয়েছে।\nসময়: ${new Date().toLocaleString('bn-BD')}`,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast('✓ Telegram টেস্ট মেসেজ সফলভাবে গেছে');
      } else {
        showToast(`Telegram টেস্ট ব্যর্থ: ${data.description || 'ভুল Token/Chat ID'}`);
      }
    } catch (e: any) {
      showToast('Telegram সংযোগ ব্যর্থ');
    } finally {
      setIsTestingTg(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!calculation || !invoiceRef.current) {
      showToast('আগে হিসাব করুন');
      return;
    }
    try {
      setIsExporting(true);
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const link = document.createElement('a');
      const filename = `Payslip_${calculation.employee.name}_${calculation.month}_${calculation.year}.png`;
      link.download = filename.replace(/\s+/g, '_');
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('HD পে-স্লিপ ছবি ডাউনলোড সম্পন্ন');
    } catch (err) {
      console.error(err);
      showToast('ছবি তৈরি করতে সমস্যা হয়েছে');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!calculation || !invoiceRef.current) {
      showToast('আগে হিসাব করুন');
      return;
    }
    try {
      setIsExporting(true);
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 3,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const heightMm = Math.max(75, Math.ceil((canvas.height / 96) * 25.4 / 3));

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [58, heightMm],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, 58, heightMm);
      const filename = `Payslip_${calculation.employee.name}_${calculation.month}.pdf`;
      pdf.save(filename.replace(/\s+/g, '_'));
      showToast('PDF স্লিপ ডাউনলোড সম্পন্ন');
    } catch (err) {
      console.error(err);
      showToast('PDF তৈরি করতে সমস্যা হয়েছে');
    } finally {
      setIsExporting(false);
    }
  };

  const handleThermalPrint = () => {
    if (!calculation || !invoiceRef.current) {
      showToast('আগে হিসাব করুন');
      return;
    }
    const result = printElement(invoiceRef.current, `PaySlip_${calculation.employee.name}_${calculation.month}`);
    if (result.isTelegram) {
      setShowTelegramPrintModal(true);
    }
  };

  const handleShare = async () => {
    if (!calculation) {
      showToast('আগে হিসাব করুন');
      return;
    }
    const c = calculation;
    const text = `
টেক্স ওয়ার অ্যাপারেলস - বেতন বিবরণী
--------------------------------
কর্মচারী: ${c.employee.name}
Worker ID: ${c.employee.workerId}
পদবি: ${c.employee.designation}
মাস: ${c.month} ${c.year}
${c.isResignationSettlement ? '★ অন্তিম দেনা-পাওনা / পদত্যাগ নিষ্পত্তি স্লিপ\n' : ''}
উপস্থিতি: ${c.presentDays} দিন | অনুপস্থিতি: ${c.absentDays} দিন ${(c.absentPenaltyDays || 0) > 0 ? `(+${c.absentPenaltyDays} দিন পেনাল্টি)` : ''}
লেট: ${c.lateDays || 0} দিন ${(c.latePenaltyDays || 0) > 0 ? `(-${c.latePenaltyDays} দিন কর্তন)` : ''}
কার্যকর প্রদেয় দিন: ${c.effectivePresentDays ?? c.presentDays} দিন
মূল অর্জিত বেতন: ${formatMoney(c.presentSalary)} ৳
ওভারটাইম (${c.otHours} ঘ. × ${c.otRate}): ${formatMoney(c.otPay)} ৳
বোনাস: +${formatMoney(c.bonus)} ৳
কর্তন ও অগ্রিম: -${formatMoney(c.advance + c.deduction)} ৳
--------------------------------
প্রদানযোগ্য নিট বেতন: ${formatMoney(c.finalSalary)} ৳
    `.trim();

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Salary Slip - ${c.employee.name}`,
          text,
        });
      } catch (e) {}
    } else {
      try {
        await navigator.clipboard.writeText(text);
        showToast('বেতন বিবরণী ক্লিপবোর্ডে কপি হয়েছে');
      } catch (e) {
        showToast('কপি করা সম্ভব হয়নি');
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* Executive Salary Calculator Top Banner + 4 Gradient KPI Cards */}
      <div className="bg-gradient-to-r from-[#08142E] via-[#0F2149] to-[#132B63] text-white rounded-2xl p-4 sm:p-5 border border-[#162752] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <Calculator className="w-5 h-5 stroke-[2.25]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                বেতন হিসাব ক্যালকুলেটর ও পে-স্লিপ স্টুডিও
              </h2>
              <p className="text-xs text-blue-200/80 mt-0.5">
                স্বয়ংক্রিয় হাজিরা সিঙ্ক, ওভারটাইম হিসাব, ৫৮ মিমি থার্মাল পে-স্লিপ ও বেতন খাতায় এন্ট্রি
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <span className="px-3 py-1.5 rounded-xl bg-[#0B1736] border border-white/15 text-xs font-bold text-cyan-300 tabular-nums">
              {month} {toBengaliNumber(year)} · সক্রিয় কর্মী {toBengaliNumber(employees.filter((e) => e.status === 'active').length)} জন
            </span>
          </div>
        </div>

        {/* 4 Vibrant Gradient KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-white/10">
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#635BFF] to-[#4338CA] text-white shadow-sm">
            <div className="text-[11px] font-medium text-white/85">প্রসেসকৃত কর্মী ({month})</div>
            <div className="text-lg sm:text-xl font-extrabold font-mono mt-1 tabular-nums">
              {toBengaliNumber(processedMonthRecords.length)} জন
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#0284C7] to-[#2563EB] text-white shadow-sm">
            <div className="text-[11px] font-medium text-white/85">সর্বমোট প্রদেয় নিট বেতন</div>
            <div className="text-lg sm:text-xl font-extrabold font-mono mt-1 tabular-nums">
              ৳ {formatMoney(totalProcessedNetPayable)}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#059669] to-[#16A34A] text-white shadow-sm">
            <div className="text-[11px] font-medium text-white/85">মোট পরিশোধিত (Paid)</div>
            <div className="text-lg sm:text-xl font-extrabold font-mono mt-1 tabular-nums">
              ৳ {formatMoney(totalProcessedPaid)}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#F97316] to-[#EA580C] text-white shadow-sm">
            <div className="text-[11px] font-medium text-white/85">অবশিষ্ট বকেয়া (Due)</div>
            <div className="text-lg sm:text-xl font-extrabold font-mono mt-1 tabular-nums">
              ৳ {formatMoney(totalProcessedDue)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div className="lg:col-span-7 space-y-4">
      {/* 1. Employee Selection Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5 font-extrabold text-slate-900 text-sm">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-xs">
              <User className="w-4 h-4" />
            </span>
            <span>কর্মচারী নির্বাচন</span>
          </div>

          {/* Toggle to include resigned employees */}
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-900 select-none">
            <input
              type="checkbox"
              checked={includeResigned}
              onChange={(e) => setIncludeResigned(e.target.checked)}
              className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <span>রিজাইনকৃত কর্মী দেখান</span>
          </label>
        </div>

        <div className="space-y-3">
          {/* Quick Search Worker by Name or ID */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="🔍 নাম বা Worker ID লিখুন..."
              value={employeeSearchText}
              onChange={(e) => {
                const val = e.target.value;
                setEmployeeSearchText(val);
                if (val.trim()) {
                  const match = employees.find((emp) =>
                    (includeResigned || emp.status === 'active') &&
                    (emp.name.toLowerCase().includes(val.toLowerCase()) ||
                     emp.workerId.toLowerCase().includes(val.toLowerCase()))
                  );
                  if (match) {
                    setSelectedId(match.id);
                  }
                }
              }}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <select
              id="userEmployeeSelect"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- কর্মচারী নির্বাচন করুন ({displayedEmployees.length} জন) --</option>
              {displayedEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} — {emp.workerId} ({emp.designation}) {
                    emp.status === 'resigned'
                      ? '[রিজাইন]'
                      : emp.status === 'suspended'
                      ? '[স্থগিত]'
                      : emp.status === 'terminated'
                      ? '[বরখাস্ত]'
                      : ''
                  }
                </option>
              ))}
            </select>
          </div>

          {/* Quick Attendance History Button */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => {
                if (selectedId) {
                  setSelectedHistoryEmpId(selectedId);
                } else if (employees.length > 0) {
                  setSelectedHistoryEmpId(employees[0].id);
                }
                setShowAttendanceHistoryModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-bold rounded-xl transition cursor-pointer active:scale-95 shadow-xs"
            >
              <History className="w-3.5 h-3.5 text-blue-600" />
              <span>দৈনিক ইন-আউট টাইম ও উপস্থিতির হিস্ট্রি</span>
            </button>
            <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
              ইন/আউট টাইম, লেট ও ওটি লগ
            </span>
          </div>

          {/* Selected Employee Summary Card */}
          {selectedEmployee && (
            <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border border-blue-200/80 rounded-xl p-3.5 text-xs text-slate-800 space-y-2">
              <div className="flex items-start gap-3">
                {selectedEmployee.photoUrl ? (
                  <img
                    src={selectedEmployee.photoUrl}
                    alt={selectedEmployee.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-xs"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                    {selectedEmployee.name.charAt(0)}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900 truncate">
                      {selectedEmployee.name}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        getStatusBadge(selectedEmployee.status).bg
                      }`}
                    >
                      {getStatusBadge(selectedEmployee.status).label}
                    </span>
                  </div>

                  <div className="text-slate-600 text-[11px] mt-0.5">
                    Worker ID: <b className="text-slate-800">{selectedEmployee.workerId}</b> | পদবি:{' '}
                    <b className="text-slate-800">{selectedEmployee.designation}</b>
                  </div>

                  <div className="text-slate-600 text-[11px]">
                    সেকশন: <b className="text-slate-800">{selectedEmployee.department || 'সাধারণ'}</b>
                  </div>
                </div>
              </div>

              {/* Salary details pill row */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-blue-200/60 text-[11px]">
                <div className="bg-white/80 p-1.5 rounded-lg border border-blue-100 flex items-center justify-between">
                  <span className="text-slate-500">মাসিক বেতন:</span>
                  <span className="font-bold text-blue-700">{formatMoney(selectedEmployee.salary)} ৳</span>
                </div>
                <div className="bg-white/80 p-1.5 rounded-lg border border-blue-100 flex items-center justify-between">
                  <span className="text-slate-500">প্রতি ঘণ্টা OT:</span>
                  <span className="font-bold text-indigo-700">{formatMoney(selectedEmployee.otRate)} ৳</span>
                </div>
              </div>

              {/* Quick View Attendance History & Contract Letter Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHistoryEmpId(selectedEmployee.id);
                    setShowAttendanceHistoryModal(true);
                  }}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition cursor-pointer active:scale-95"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>উপস্থিতির হিস্ট্রি</span>
                </button>

                <button
                  type="button"
                  onClick={() => setContractLetterEmp(selectedEmployee)}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs shadow-xs transition cursor-pointer active:scale-95"
                  title="শ্রমিক নিয়োগ চুক্তিপত্র প্রিভিউ ও A4 প্রিন্ট করুন"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-950" />
                  <span>চুক্তিপত্র প্রিভিউ ও প্রিন্ট</span>
                </button>
              </div>

              {/* Resignation Alert if Resigned */}
              {selectedEmployee.status === 'resigned' && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-start gap-2">
                  <UserX className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-bold">কর্মী চাকরি থেকে পদত্যাগ / রিজাইন করেছেন</div>
                    <div>তারিখ: {formatDateBn(selectedEmployee.resignationDate)} | কারণ: {selectedEmployee.resignationReason || 'উল্লেখ নেই'}</div>
                    {selectedEmployee.finalSettlementPaid ? (
                      <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-semibold">
                        ✓ পূর্বেই চূড়ান্ত দেনা-পাওনা পরিশোধিত
                      </span>
                    ) : (
                      <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-semibold">
                        ⏳ চূড়ান্ত দেনা-পাওনা নিষ্পত্তি এখনো পেন্ডিং
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {onOpenResignationLetter && (
                      <button
                        type="button"
                        onClick={() => onOpenResignationLetter(selectedEmployee)}
                        className="text-[10px] bg-amber-500 hover:bg-amber-400 text-slate-950 px-2 py-1 rounded-md font-black hover:shadow-xs cursor-pointer flex items-center gap-1 transition active:scale-95 shadow-2xs"
                        title="১-ক্লিকে পদত্যাগ ফরম প্রিন্ট করুন"
                      >
                        <Printer className="w-3 h-3" />
                        <span>রিজাইন ফরম</span>
                      </button>
                    )}
                    {onOpenResignationModal && (
                      <button
                        type="button"
                        onClick={() => onOpenResignationModal(selectedEmployee)}
                        className="text-[10px] bg-white border border-rose-300 text-rose-700 px-2 py-1 rounded-md font-semibold hover:bg-rose-100 cursor-pointer"
                      >
                        স্ট্যাটাস
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Suspension Alert if Suspended */}
              {selectedEmployee.status === 'suspended' && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-bold">কর্মী সাময়িক স্থগিতাদেশে আছেন (তদন্তাধীন)</div>
                    <div>তারিখ: {formatDateBn(selectedEmployee.suspensionDate || selectedEmployee.resignationDate)} | কারণ: {selectedEmployee.suspensionReason || selectedEmployee.resignationReason || 'শৃঙ্খলাভঙ্গ সংক্রান্ত অভিযোগ'}</div>
                    <div className="text-[10px] text-amber-700 mt-0.5">মেয়াদ: {selectedEmployee.suspensionDuration || '৭ কার্যদিবস'}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {onOpenSuspensionNotice && (
                      <button
                        type="button"
                        onClick={() => onOpenSuspensionNotice(selectedEmployee)}
                        className="text-[10px] bg-amber-600 hover:bg-amber-500 text-white px-2 py-1 rounded-md font-black hover:shadow-xs cursor-pointer flex items-center gap-1 transition active:scale-95 shadow-2xs"
                        title="১-ক্লিকে স্থগিতাদেশ নোটিশ প্রিন্ট করুন"
                      >
                        <Printer className="w-3 h-3" />
                        <span>স্থগিত নোটিশ</span>
                      </button>
                    )}
                    {onOpenResignationModal && (
                      <button
                        type="button"
                        onClick={() => onOpenResignationModal(selectedEmployee)}
                        className="text-[10px] bg-white border border-amber-300 text-amber-700 px-2 py-1 rounded-md font-semibold hover:bg-amber-100 cursor-pointer"
                      >
                        স্ট্যাটাস
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Termination Alert if Terminated */}
              {selectedEmployee.status === 'terminated' && (
                <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-300 text-slate-900 text-[11px] flex items-start gap-2">
                  <RotateCcw className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-bold">কর্মী কারখানা থেকে চূড়ান্ত বরখাস্ত / অব্যাহতিপ্রাপ্ত</div>
                    <div>তারিখ: {formatDateBn(selectedEmployee.terminationDate || selectedEmployee.resignationDate)} | কারণ: {selectedEmployee.terminationReason || selectedEmployee.resignationReason || 'অসদাচরণ বা শৃঙ্খলাভঙ্গ'}</div>
                    {selectedEmployee.terminationMemo && (
                      <div className="text-[10px] text-slate-600 mt-0.5">অফিস মেমো: {selectedEmployee.terminationMemo}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {onOpenTerminationNotice && (
                      <button
                        type="button"
                        onClick={() => onOpenTerminationNotice(selectedEmployee)}
                        className="text-[10px] bg-slate-900 hover:bg-black text-white px-2 py-1 rounded-md font-black hover:shadow-xs cursor-pointer flex items-center gap-1 transition active:scale-95 shadow-2xs"
                        title="১-ক্লিকে বরখাস্ত ও অব্যাহতি পত্র প্রিন্ট করুন"
                      >
                        <Printer className="w-3 h-3" />
                        <span>অব্যাহতি পত্র</span>
                      </button>
                    )}
                    {onOpenResignationModal && (
                      <button
                        type="button"
                        onClick={() => onOpenResignationModal(selectedEmployee)}
                        className="text-[10px] bg-white border border-slate-400 text-slate-800 px-2 py-1 rounded-md font-semibold hover:bg-slate-200 cursor-pointer"
                      >
                        স্ট্যাটাস
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Salary Calculation Parameters Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/90 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5 font-extrabold text-slate-900 text-sm">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-xs">
              <Calendar className="w-4 h-4" />
            </span>
            <span>মাস, কার্যদিবস ও হাজিরা</span>
          </div>

          {/* Resignation settlement flag */}
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-rose-700 select-none bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
            <input
              type="checkbox"
              checked={isResignationSettlement}
              onChange={(e) => setIsResignationSettlement(e.target.checked)}
              className="w-3.5 h-3.5 text-rose-600 rounded border-rose-300 focus:ring-rose-500"
            />
            <span>চুড়ান্ত নিষ্পত্তি স্লিপ (Settlement)</span>
          </label>
        </div>

        {/* Month & Working Days Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">বেতনের মাস *</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full py-2 px-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500"
            >
              {BENGALI_MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">বছর</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full py-2 px-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">মোট কার্যদিবস *</label>
            <select
              value={totalDays}
              onChange={(e) => setTotalDays(Number(e.target.value))}
              className="w-full py-2 px-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500"
            >
              <option value={26}>২৬ দিন (স্ট্যান্ডার্ড)</option>
              <option value={24}>২৪ দিন</option>
              <option value={28}>২৮ দিন</option>
              <option value={30}>৩০ দিন</option>
            </select>
          </div>
        </div>

        {/* Attendance Auto-Sync Banner */}
        {selectedEmployee && attendanceForMonth && attendanceForMonth.totalRecords > 0 ? (
          <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-300 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-black text-emerald-950">✓ হাজিরা খাতা থেকে স্বয়ংক্রিয়ভাবে লোড হয়েছে ({month} {year}):</span>{' '}
                <span className="text-slate-800 font-bold">
                  উপস্থিতি <b>{attendanceForMonth.presentCount}</b> দিন (লেট <b>{attendanceForMonth.lateCount}</b>), অনুপস্থিত <b>{attendanceForMonth.absentCount}</b> দিন, ওভারটাইম <b>{attendanceForMonth.totalOtHours}</b> ঘণ্টা
                  {attendanceForMonth.fridayOtHours && attendanceForMonth.fridayOtHours > 0 ? (
                    <span
                      className="text-indigo-700 font-black ml-1.5"
                      title="শুক্রবার কাজ করায় দুপুর ১টা থেকে ২টা পর্যন্ত ১ ঘণ্টা নামাজের ও খাবারের বিরতি বাদ দিয়ে ওটি হিসাব করা হয়েছে"
                    >
                      [শুক্র ওটি: {attendanceForMonth.fridayOtHours}ঘ. (১-২টা বিরতি বাদ)]
                    </span>
                  ) : null}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setSelectedHistoryEmpId(selectedEmployee.id);
                  setShowAttendanceHistoryModal(true);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition active:scale-95 whitespace-nowrap cursor-pointer"
                title="দৈনিক ইন-আউট টাইম ও উপস্থিতির হিস্ট্রি বিস্তারিত দেখুন"
              >
                <History className="w-3.5 h-3.5" />
                <span>দৈনিক ইন-আউট হিস্ট্রি</span>
              </button>
              <button
                type="button"
                onClick={handleApplyAttendanceToCalculator}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition active:scale-95 whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>পুনরায় সিঙ্ক করুন</span>
              </button>
            </div>
          </div>
        ) : selectedEmployee ? (
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{month} {year} মাসে এই কর্মীর কোনো সংরক্ষিত হাজিরা নেই (ডিফল্ট ধরা হয়েছে)</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedHistoryEmpId(selectedEmployee.id);
                setShowAttendanceHistoryModal(true);
              }}
              className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold text-xs flex items-center gap-1 cursor-pointer transition active:scale-95 self-start sm:self-auto"
            >
              <History className="w-3.5 h-3.5" />
              <span>সকল মাসের ইন-আউট হিস্ট্রি দেখুন</span>
            </button>
          </div>
        ) : null}

        {/* Attendance Days Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <label className="block text-[11px] font-bold text-slate-800 mb-1">
              উপস্থিত দিন (Present) *
            </label>
            <input
              type="number"
              min={0}
              max={totalDays}
              value={presentDays}
              onChange={(e) => setPresentDays(Number(e.target.value))}
              className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-blue-700 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <label className="block text-[11px] font-bold text-slate-800 mb-1">
              অনুপস্থিত দিন (Absent)
            </label>
            <input
              type="number"
              readOnly
              value={joinPolicy.isNewJoinerMidMonth ? 0 : absentDays}
              className="w-full py-1.5 px-2 bg-slate-100 border border-slate-300 rounded-lg text-sm font-bold text-rose-700"
            />
            {joinPolicy.isNewJoinerMidMonth && (
              <span className="text-[10px] text-emerald-700 font-bold block mt-1">
                নতুন কর্মী: কোনো কর্তন নেই
              </span>
            )}
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <label className="block text-[11px] font-bold text-slate-800 mb-1">
              বিলম্ব / লেট দিন (Late)
            </label>
            <input
              type="number"
              min={0}
              max={totalDays}
              value={lateDays}
              onChange={(e) => setLateDays(Math.max(0, Number(e.target.value) || 0))}
              className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-amber-700 focus:ring-2 focus:ring-amber-500"
            />
            {joinPolicy.isNewJoinerMidMonth && (
              <span className="text-[10px] text-emerald-700 font-bold block mt-1">
                খণ্ডিত মাসে লেট কর্তন নেই
              </span>
            )}
          </div>

          <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-300">
            <label className="block text-[11px] font-bold text-emerald-900 mb-1">
              কার্যকর প্রদেয় হাজিরা
            </label>
            <div className="py-1.5 px-2 bg-white border border-emerald-400 rounded-lg text-sm font-black text-emerald-800">
              {joinPolicy.isNewJoinerMidMonth
                ? `${presentDays} দিন (শুধু হাজিরা)`
                : `${Math.max(0, presentDays - Math.floor((Math.max(0, absentDays) + Math.max(0, lateDays)) / 3))} দিন`}
            </div>
          </div>
        </div>

        {/* Factory Attendance Rules or New Joiner Policy Card */}
        {joinPolicy.isNewJoinerMidMonth ? (
          <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 text-xs text-emerald-950 space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5 text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>নতুন কর্মী বিশেষ হাজিরা নীতি ({joinPolicy.joinDay} {joinPolicy.joinMonthName} যোগদান):</span>
              </span>
              <span className="text-[10px] bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                নতুন কর্মী (খণ্ডিত মাস)
              </span>
            </div>
            <p className="text-[11.5px] text-emerald-800 leading-relaxed">
              কর্মী মাসের মাঝামাঝি ({formatDateBn(selectedEmployee?.joinDate)}) যোগদান করায় <b>শুধুমাত্র উপস্থিত কার্যদিবসের ({toBengaliNumber(presentDays)} দিন)</b> মজুরি হিসাব হবে। পূর্ববর্তী অনুপস্থিতি বা লেটের কোনো কর্তন হবে না এবং এ মাসে কোনো হাজিরা বোনাস কার্যকর নয়।
            </p>
            <div className="text-[10.5px] font-semibold text-slate-600 border-t border-emerald-200/70 pt-1">
              ✓ পরবর্তী পুরো মাস থেকে নিয়মিত সকল কারখানার নিয়ম (হাজিরা বোনাস, লেট কর্তন ইত্যাদি) স্বয়ংক্রিয়ভাবে কার্যকর হবে।
            </div>
          </div>
        ) : joinPolicy.isFirstDayJoiner ? (
          <div className="p-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-xs text-blue-950 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5 text-blue-900">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>১ তারিখে যোগদানকারী কর্মী ({joinPolicy.joinMonthName} {toBengaliNumber(joinPolicy.joinYear)}):</span>
              </span>
              <span className="text-[10px] bg-blue-100 text-blue-900 px-2 py-0.5 rounded-full font-bold">
                ১ম তারিখ থেকে নিয়মিত কর্মী
              </span>
            </div>
            <p className="text-[11.5px] text-blue-900 leading-relaxed">
              কর্মী মাসের ১ তারিখে যোগদান করায় পূর্ণ মাসের নিয়মিত কর্মচারী হিসেবে সমন্বিত লেট ও অনুপস্থিতি নীতি এবং হাজিরা বোনাস প্রযোজ্য।
            </p>
            <div className="p-2 rounded-lg bg-white border border-blue-200 text-[11px]">
              • লেট ও অনুপস্থিতি মিলে প্রতি ৩ দিনে ১ দিন কাটা (যেমন: ১ দিন লেট + ২ দিন অনুপস্থিত, বা ২ দিন লেট + ১ দিন অনুপস্থিত = ৩ দিন হয়ে ১ দিন কাটা)
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 text-xs text-amber-950 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5 text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>কারখানার সমন্বিত হাজিরা ও কর্তন নীতি (স্বয়ংক্রিয় গণনা):</span>
              </span>
              <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                সমন্বিত ৩ দিন নীতি
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-white/95 border border-amber-200 space-y-1 text-[11px]">
              <div className="text-slate-800 font-bold">
                • লেট ও অনুপস্থিতি মিলে প্রতি ৩ দিন কাউন্ট হলে ১ দিনের হাজিরা কাটা:
              </div>
              <div className="text-amber-900 font-medium leading-relaxed">
                অনুপস্থিতি: <b>{absentDays} দিন</b> + লেট: <b>{lateDays} দিন</b> = মোট সমন্বয় <b className="text-rose-700">{absentDays + lateDays} দিন</b>।
                প্রতি ৩ দিনের জন্য <b className="text-rose-700">{Math.floor((absentDays + lateDays) / 3)} দিন</b> হাজিরা কর্তন।
              </div>
              <div className="text-[10.5px] text-slate-500 italic">
                (যেমন: ১ দিন লেট + ২ দিন অনুপস্থিত, বা ২ দিন লেট + ১ দিন অনুপস্থিত = ৩ দিন হয়ে ১ দিনের হাজিরা বাদ যাবে)
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between pt-1 border-t border-amber-200/80 text-[11.5px] font-bold text-slate-700">
              <span>
                মোট অনুপস্থিতি ও জরিমানা কর্তন: <span className="text-rose-700 font-black">{absentDays + Math.floor((absentDays + lateDays) / 3)} দিন</span>
              </span>
              <span className="text-emerald-800 font-black">
                মূল বেতনযোগ্য কার্যকরী দিন: {Math.max(0, presentDays - Math.floor((absentDays + lateDays) / 3))} দিন
              </span>
            </div>
            {joinPolicy.isSubsequentMonth && (
              <div className="text-[10.5px] text-slate-600 border-t border-amber-200/70 pt-1">
                ✓ কর্মী পরবর্তী নিয়মিত মাসে থাকায় সমন্বিত লেট ও অনুপস্থিতি কর্তন এবং হাজিরা বোনাস কার্যকর।
              </div>
            )}
          </div>
        )}

        {/* Overtime Section */}
        <div className="pt-2">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-xs mb-2">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>ওভারটাইম (OT) বিবরণ</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  ওভারটাইম ঘণ্টা (OT Hours)
                </label>
                {otHours > 0 && selectedEmployee && (
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    বিল: {formatMoney(Math.round(otHours * (selectedEmployee.otRate || 0)))} ৳
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={otHours}
                  onChange={(e) => setOtHours(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0"
                  className="w-full py-2 px-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-indigo-900 focus:ring-2 focus:ring-blue-500"
                />

                {/* Quick OT increment buttons */}
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setOtHours((prev) => Math.round((prev + 1) * 10) / 10)}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition cursor-pointer"
                  >
                    +১h
                  </button>
                  <button
                    type="button"
                    onClick={() => setOtHours((prev) => Math.round((prev + 2) * 10) / 10)}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition cursor-pointer"
                  >
                    +২h
                  </button>
                  <button
                    type="button"
                    onClick={() => setOtHours((prev) => Math.round((prev + 5) * 10) / 10)}
                    className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold border border-indigo-200 transition cursor-pointer"
                  >
                    +৫h
                  </button>
                  <button
                    type="button"
                    onClick={() => setOtHours((prev) => Math.round((prev + 10) * 10) / 10)}
                    className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold border border-indigo-200 transition cursor-pointer"
                  >
                    +১০h
                  </button>
                  {otHours > 0 && (
                    <button
                      type="button"
                      onClick={() => setOtHours(0)}
                      className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-bold border border-rose-200 transition cursor-pointer"
                    >
                      ০h
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                প্রতি ঘণ্টা রেট (OT Rate)
              </label>
              <input
                type="number"
                readOnly
                value={selectedEmployee ? selectedEmployee.otRate : 0}
                className="w-full py-2 px-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                {selectedEmployee ? `${selectedEmployee.name}-এর নির্ধারিত ওভারটাইম রেট` : 'কর্মী অনুযায়ী স্বয়ংক্রিয়'}
              </p>
            </div>
          </div>
        </div>

        {/* Bonus & Deductions Section */}
        <div className="pt-2 space-y-3">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
            <DollarSign className="w-3.5 h-3.5 text-blue-600" />
            <span>বোনাস ও কর্তন</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-emerald-800 mb-1">
                হাজিরা বোনাস (+) ৳
              </label>
              <input
                type="number"
                min={0}
                disabled={joinPolicy.isNewJoinerMidMonth || absentDays > 0 || (lateDays || 0) > 0}
                value={joinPolicy.isNewJoinerMidMonth || absentDays > 0 || (lateDays || 0) > 0 ? 0 : attendanceBonus}
                onChange={(e) => setAttendanceBonus(Number(e.target.value))}
                placeholder="0"
                className={`w-full py-2 px-2.5 border rounded-xl text-xs font-semibold focus:ring-2 ${
                  joinPolicy.isNewJoinerMidMonth
                    ? 'bg-amber-50/70 border-amber-300 text-amber-800 cursor-not-allowed'
                    : absentDays > 0 || (lateDays || 0) > 0
                    ? 'bg-rose-50/70 border-rose-300 text-rose-700 cursor-not-allowed'
                    : 'bg-white border-slate-300 text-emerald-700 focus:ring-emerald-500'
                }`}
              />
              {joinPolicy.isNewJoinerMidMonth ? (
                <span className="text-[10px] text-amber-700 font-bold block mt-1 leading-tight">
                  ℹ️ নতুন কর্মীর খণ্ডিত মাসে বোনাস প্রযোজ্য নয় (পরবর্তী মাস থেকে পূর্ণ উপস্থিতিতে ৫০০৳ কার্যকর হবে)
                </span>
              ) : absentDays > 0 || (lateDays || 0) > 0 ? (
                <span className="text-[10px] text-rose-700 font-bold block mt-1 leading-tight">
                  ⚠️ অনুপস্থিত ({toBengaliNumber(absentDays)} দিন) বা লেট ({toBengaliNumber(lateDays || 0)} দিন) থাকায় কোনো বোনাস নেই (৳ ০)
                </span>
              ) : (
                <span className="text-[10px] text-emerald-700 font-bold block mt-1">
                  ✓ শতভাগ উপস্থিত ও লেটমুক্ত থাকায় বোনাস প্রযোজ্য
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-800 mb-1">
                উৎসব / স্পেশাল বোনাস (+) ৳
              </label>
              <input
                type="number"
                min={0}
                value={festivalBonus}
                onChange={(e) => setFestivalBonus(Number(e.target.value))}
                placeholder="0"
                className="w-full py-2 px-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-emerald-700 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-rose-800 mb-1">
                অগ্রিম কর্তন (-) ৳
              </label>
              <input
                type="number"
                min={0}
                value={advance}
                onChange={(e) => setAdvance(Number(e.target.value))}
                placeholder="0"
                className="w-full py-2 px-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-rose-700 focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-rose-800 mb-1">
                অন্যান্য কর্তন (-) ৳
              </label>
              <input
                type="number"
                min={0}
                value={deduction}
                onChange={(e) => setDeduction(Number(e.target.value))}
                placeholder="0"
                className="w-full py-2 px-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-rose-700 focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              কর্তনের কারণ / বিবরণ (ঐচ্ছিক)
            </label>
            <input
              type="text"
              value={deductionReason}
              onFocus={() => setIsWritingComment(true)}
              onBlur={() => setIsWritingComment(false)}
              onChange={(e) => setDeductionReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
              }}
              autoComplete="off"
              placeholder="যেমন: অনুপস্থিতি জরিমানা, ইউনিফর্ম ড্যামেজ, ইত্যাদি"
              className="w-full py-2 px-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Calculate Action Button */}
        <button
          type="button"
          onClick={handleCalculate}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#1D63DC] to-[#2563EB] hover:from-blue-600 hover:to-blue-700 text-white font-extrabold text-sm shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Calculator className="w-4 h-4" />
          <span>বেতন হিসাব করুন ও স্লিপ দেখুন</span>
        </button>

        {/* "বেতন খাতায় যোগ করুন (Add to Pay Book)" Action Box */}
        {calculation && (
          <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 border-2 border-indigo-200/80 shadow-xs space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-indigo-600" />
                <span>বেতন খাতা (Pay Book) স্ট্যাটাস:</span>
              </span>
              {isAddedToPayBook ? (
                <span className="px-2.5 py-0.5 rounded-md bg-amber-500 text-white font-bold text-[11px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  <span>পেন্ডিং (Pending)</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-md bg-slate-200 text-slate-700 font-bold text-[10px]">
                  এখনো খাতায় যোগ হয়নি
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={isAddingToPayBook}
              onClick={handleAddToPayBook}
              className={`w-full py-3 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer active:scale-98 ${
                isAddedToPayBook
                  ? 'bg-amber-600 hover:bg-amber-700 text-white ring-2 ring-amber-400/40'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400/40'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isAddingToPayBook
                  ? 'বেতন খাতায় যোগ হচ্ছে...'
                  : isAddedToPayBook
                  ? '✓ বেতন খাতায় যোগ হয়েছে (পেন্ডিং) — পুনরায় হালনাগাদ করতে চাপুন'
                  : '📥 বেতন খাতায় যোগ করুন (Add to Pay Book)'}
              </span>
            </button>
            <p className="text-[11px] text-slate-600 text-center font-medium">
              {isAddedToPayBook
                ? '✅ হিসাবটি এডমিনের বেতন খাতায় "পেন্ডিং" হিসেবে যুক্ত রয়েছে। (একই ব্যক্তির ডুপ্লিকেট এন্ট্রি হবে না)'
                : '👉 "বেতন খাতায় যোগ করুন" বাটনে চাপলে এটি এডমিনের বেতন খাতায় "পেন্ডিং" হিসেবে যুক্ত হবে।'}
            </p>
          </div>
        )}
      </div>
      </div>

      {/* 3. POS Pay Slip Preview & Actions Column */}
      <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5 font-extrabold text-slate-900 text-sm">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center shadow-xs">
              <Receipt className="w-4 h-4" />
            </span>
            <span>Pay Slip Preview</span>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
            POS 58mm Thermal
          </span>
        </div>

        {/* Salary Book Auto-Save & Status Badge */}
        {calculation && (
          <div className="mb-3.5 p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex flex-col gap-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
              <span className="text-slate-800 font-semibold">
                বেতন খাতা স্ট্যাটাস:
                <span className={`ml-1.5 px-2 py-0.5 rounded font-bold ${
                  isAddedToPayBook ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {isAddedToPayBook ? 'পেন্ডিং (Pending)' : 'যোগ করার অপেক্ষায়'}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-bold bg-white/80 px-2.5 py-1 rounded-lg border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{isAddedToPayBook ? 'এডমিন বেতন খাতায় সংরক্ষিত' : 'উপরের বাটনে চেপে খাতায় যোগ করুন'} • ডুপ্লিকেট হবে না</span>
            </div>
          </div>
        )}

        {/* Invoice Wrap */}
        <div className="flex justify-center bg-slate-100/80 p-3 sm:p-5 rounded-xl overflow-x-auto border border-slate-200">
          {/* Printable 58mm POS receipt element */}
          <div
            id="invoicePrintArea"
            ref={invoiceRef}
            className="w-[220px] bg-white text-slate-900 p-3 shadow-md rounded-sm font-['Noto_Sans_Bengali',sans-serif] text-[9px] leading-tight select-text"
            style={{ minHeight: '320px' }}
          >
            {/* Thermal Slip Header */}
            <div className="text-center border-b border-dashed border-slate-800 pb-2 mb-2">
              <h2 className="text-[13px] font-black tracking-tight leading-tight">
                টেক্স ওয়ার অ্যাপারেলস
              </h2>
              <p className="text-[8px] text-slate-700 font-semibold mt-0.5">
                {calculation?.isResignationSettlement
                  ? 'অন্তিম দেনা-পাওনা / ছাড়পত্র স্লিপ'
                  : 'মাসিক বেতন বিবরণী'}
              </p>
            </div>

            {calculation ? (
              <div className="space-y-1.5">
                {/* Employee Meta Info */}
                <table className="w-full border-collapse text-[8.5px]">
                  <tbody>
                    <tr>
                      <td className="py-0.5 text-slate-600">নাম:</td>
                      <td className="py-0.5 font-bold text-right text-slate-900 truncate max-w-[120px]">
                        {calculation.employee.name}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-0.5 text-slate-600">Worker ID:</td>
                      <td className="py-0.5 font-bold text-right">{calculation.employee.workerId}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 text-slate-600">পদবি:</td>
                      <td className="py-0.5 text-right font-medium">{calculation.employee.designation}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 text-slate-600">মাস ও বছর:</td>
                      <td className="py-0.5 text-right font-bold">
                        {calculation.month} {calculation.year}
                      </td>
                    </tr>
                    {calculation.employee.status === 'resigned' && (
                      <tr>
                        <td className="py-0.5 text-rose-700 font-bold">স্ট্যাটাস:</td>
                        <td className="py-0.5 text-right text-rose-700 font-bold">পদত্যাগকৃত (Resigned)</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Days & Attendance */}
                <div className="border-t border-dotted border-slate-400 pt-1 space-y-0.5">
                  <div className="flex justify-between text-[8px] text-slate-700">
                    <span>মোট কার্যদিবস:</span>
                    <span className="font-bold">{calculation.totalDays} দিন</span>
                  </div>
                  <div className="flex justify-between text-[8px] text-slate-700">
                    <span>উপস্থিত দিন:</span>
                    <span className="font-bold">{calculation.presentDays} দিন</span>
                  </div>
                  <div className="flex justify-between text-[8px] text-slate-700">
                    <span>অনুপস্থিত দিন:</span>
                    <span className="text-rose-700 font-semibold">
                      {calculation.absentDays} দিন
                      {(calculation.absentPenaltyDays || 0) > 0 && ` (+${calculation.absentPenaltyDays}d পেনাল্টি)`}
                    </span>
                  </div>
                  {((calculation.lateDays || 0) > 0 || (calculation.latePenaltyDays || 0) > 0) && (
                    <div className="flex justify-between text-[8px] text-slate-700">
                      <span>লেট / বিলম্ব দিন:</span>
                      <span className="text-amber-800 font-semibold">
                        {calculation.lateDays || 0} দিন
                        {(calculation.latePenaltyDays || 0) > 0 && ` (-${calculation.latePenaltyDays}d কর্তন)`}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-[8px] text-emerald-900 font-bold border-t border-dotted border-slate-300 pt-0.5">
                    <span>কার্যকর প্রদেয় হাজিরা:</span>
                    <span>{calculation.effectivePresentDays ?? calculation.presentDays} দিন</span>
                  </div>
                </div>

                {/* Earnings breakdown */}
                <div className="border-t border-dashed border-slate-700 pt-1 space-y-0.5">
                  <div className="flex justify-between text-[8.5px]">
                    <span className="text-slate-600">মূল অর্জিত বেতন:</span>
                    <span className="font-semibold">{formatMoney(calculation.presentSalary)} ৳</span>
                  </div>

                  {calculation.otHours > 0 && (
                    <div className="flex justify-between text-[8.5px]">
                      <span className="text-slate-600">
                        OT ({calculation.otHours} ঘ. × {calculation.otRate}):
                      </span>
                      <span className="font-semibold">+{formatMoney(calculation.otPay)} ৳</span>
                    </div>
                  )}

                  {calculation.bonus > 0 && (
                    <div className="flex justify-between text-[8.5px] text-emerald-800">
                      <span>মোট বোনাস:</span>
                      <span className="font-semibold">+{formatMoney(calculation.bonus)} ৳</span>
                    </div>
                  )}

                  {calculation.advance > 0 && (
                    <div className="flex justify-between text-[8.5px] text-rose-800">
                      <span>অগ্রিম কর্তন:</span>
                      <span className="font-semibold">-{formatMoney(calculation.advance)} ৳</span>
                    </div>
                  )}

                  {calculation.deduction > 0 && (
                    <div className="flex justify-between text-[8.5px] text-rose-800">
                      <span>অন্যান্য কর্তন:</span>
                      <span className="font-semibold">-{formatMoney(calculation.deduction)} ৳</span>
                    </div>
                  )}

                  {calculation.deductionReason && (
                    <div className="text-[7.5px] text-slate-500 italic text-right">
                      (কারণ: {calculation.deductionReason})
                    </div>
                  )}
                </div>

                {/* Total Payable Net Salary */}
                <div className="border-y-2 border-dashed border-slate-900 py-1.5 my-1 text-center bg-slate-50">
                  <div className="text-[8px] uppercase tracking-wider text-slate-700 font-bold">
                    প্রদানযোগ্য নিট বেতন
                  </div>
                  <div className="text-[14px] font-black text-slate-950">
                    {formatMoney(calculation.finalSalary)} ৳
                  </div>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-4 pt-3 pb-1">
                  <div className="flex flex-col justify-end">
                    <div className="h-6 flex items-end justify-center pb-0.5">
                      <span className="text-[6.5px] text-slate-400 italic">..................</span>
                    </div>
                    <div className="border-t border-slate-800 text-center text-[7.5px] text-slate-700 pt-0.5 font-bold">
                      কর্তৃপক্ষের স্বাক্ষর
                    </div>
                  </div>
                  <div className="flex flex-col justify-end">
                    <div className="h-6 flex items-end justify-center pb-0.5">
                      {calculation.employee.signatureUrl ? (
                        <img
                          src={calculation.employee.signatureUrl}
                          alt="শ্রমিকের স্বাক্ষর"
                          className="max-h-5 max-w-[80px] object-contain"
                        />
                      ) : (
                        <span className="text-[6.5px] text-slate-400 italic">..................</span>
                      )}
                    </div>
                    <div className="border-t border-slate-800 text-center text-[7.5px] text-slate-700 pt-0.5 font-bold">
                      শ্রমিকের স্বাক্ষর
                    </div>
                  </div>
                </div>

                {/* Footer Timestamp */}
                <div className="text-center text-[6.5px] text-slate-400 pt-1">
                  প্রিন্ট: {new Date().toLocaleDateString('bn-BD')} {new Date().toLocaleTimeString('bn-BD')}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-[10px] space-y-1">
                <AlertCircle className="w-6 h-6 mx-auto text-slate-300" />
                <p>হিসাব দেখতে উপরে কর্মচারী নির্বাচন করে "হিসাব করুন" বাটনে চাপুন</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <button
            type="button"
            disabled={!calculation || isExporting}
            onClick={handleDownloadImage}
            className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <FileImage className="w-3.5 h-3.5" />
            <span>HD ছবি ডাউনলোড</span>
          </button>

          <button
            type="button"
            disabled={!calculation || isExporting}
            onClick={handleDownloadPDF}
            className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF স্লিপ</span>
          </button>

          {!isWritingComment && (
            <button
              type="button"
              disabled={!calculation}
              onClick={handleThermalPrint}
              className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-black disabled:opacity-50 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>POS Print</span>
            </button>
          )}

          <button
            type="button"
            disabled={!calculation}
            onClick={handleShare}
            className="py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share / Copy</span>
          </button>

          {/* SMS & Telegram Action Buttons */}
          <button
            type="button"
            disabled={!calculation}
            onClick={handleOpenSmsModal}
            className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            title="শ্রমিককে এসএমএস পাঠান"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>SMS পাঠান</span>
          </button>

          <button
            type="button"
            disabled={!calculation}
            onClick={handleSendTelegramSalary}
            className="py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            title="Telegram Bot বা অ্যাপে পাঠান"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Telegram পাঠান</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="col-span-2 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 shadow-2xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            title="Auto SMS ও Telegram Bot সেটিংস কনফিগার করুন"
          >
            <Settings className="w-3.5 h-3.5 text-blue-600" />
            <span>Auto SMS ও Telegram সেটিংস</span>
          </button>
        </div>
      </div>
      </div>
      </div>

        {/* ================= 4. PROCESSED EMPLOYEES NET PAYABLE SUMMARY SECTION ================= */}
        <div className="mt-5 border border-slate-200/90 rounded-2xl bg-white overflow-hidden shadow-xs">
          <div className="p-3.5 sm:p-4 bg-gradient-to-r from-[#08142E] via-[#0F2149] to-[#132B63] text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white shrink-0 shadow-sm">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-tight flex items-center gap-2 flex-wrap">
                  <span>{month} {toBengaliNumber(year)} সর্বমোট প্রদানযোগ্য নিট বেতন সারসংক্ষেপ</span>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-bold">
                    প্রসেসকৃত: {toBengaliNumber(processedMonthRecords.length)} জন
                  </span>
                </h3>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  সকল প্রসেসকৃত ও সংরক্ষিত কর্মচারীর মোট নিট প্রদেয় বেতন (Net Payable Salary) সমষ্টি ও হিসাব বিবরণী
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowNetPayableSummary(!showNetPayableSummary)}
              className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 border border-white/15 transition cursor-pointer"
            >
              {showNetPayableSummary ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-indigo-300" />
                  <span>সামারি লুকান</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-indigo-300" />
                  <span>সামারি দেখুন</span>
                </>
              )}
            </button>
          </div>

          {showNetPayableSummary && (
            <div className="p-4 sm:p-5 space-y-4">
              {/* Grand Total Net Payable Highlight Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-100/50 border-2 border-indigo-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
                <div>
                  <span className="text-xs uppercase font-bold tracking-wider text-indigo-700">
                    সর্বমোট প্রদেয় নিট বেতন (Total Net Payable Salary)
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-indigo-950 font-mono tracking-tight mt-0.5">
                    ৳ {formatMoney(totalProcessedNetPayable)}
                  </div>
                  <span className="text-[11px] text-slate-600 font-medium">
                    {month} {toBengaliNumber(year)} মাসে সংরক্ষিত মোট {toBengaliNumber(processedMonthRecords.length)} জন কর্মচারীর নিট মজুরি
                  </span>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <div className="p-2.5 px-3 rounded-xl bg-white border border-emerald-200 shadow-2xs">
                    <div className="text-[10px] text-emerald-700 font-bold uppercase">পরিশোধিত (Paid)</div>
                    <div className="text-sm font-black text-emerald-800 font-mono">
                      ৳ {formatMoney(totalProcessedPaid)}
                    </div>
                  </div>
                  <div className="p-2.5 px-3 rounded-xl bg-white border border-rose-200 shadow-2xs">
                    <div className="text-[10px] text-rose-700 font-bold uppercase">বকেয়া (Due)</div>
                    <div className="text-sm font-black text-rose-800 font-mono">
                      ৳ {formatMoney(totalProcessedDue)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Metric Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-semibold block">মোট প্রসেসকৃত কর্মী</span>
                  <span className="text-base font-black text-slate-800">{toBengaliNumber(processedMonthRecords.length)} জন</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-semibold block">মোট বেসিক বেতন</span>
                  <span className="text-base font-black text-slate-800 font-mono">৳ {formatMoney(totalProcessedBasic)}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-semibold block">মোট ওভারটাইম বিল</span>
                  <span className="text-base font-black text-indigo-700 font-mono">৳ {formatMoney(totalProcessedOt)}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-semibold block">মোট কর্তন (অগ্রিম/অন্যান্য)</span>
                  <span className="text-base font-black text-rose-700 font-mono">-৳ {formatMoney(totalProcessedDeduction)}</span>
                </div>
              </div>

              {/* Table of Processed Records */}
              {processedMonthRecords.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100/80 px-3 py-2 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-700">
                    <span>প্রসেসকৃত কর্মচারীদের তালিকা ও নিট প্রদেয়</span>
                    <span className="text-[11px] text-slate-500 font-normal">
                      {toBengaliNumber(processedMonthRecords.length)} টি রেকর্ড সংরক্ষিত
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-slate-600 font-bold sticky top-0 border-b border-slate-200 z-10 text-[11px]">
                        <tr>
                          <th className="p-2 border-r border-slate-200 w-10 text-center">নং</th>
                          <th className="p-2 border-r border-slate-200">আইডি ও নাম</th>
                          <th className="p-2 border-r border-slate-200">পদবি ও বিভাগ</th>
                          <th className="p-2 border-r border-slate-200 text-center">হাজিরা</th>
                          <th className="p-2 border-r border-slate-200 text-right">মূল বেতন</th>
                          <th className="p-2 border-r border-slate-200 text-right">ওভারটাইম</th>
                          <th className="p-2 border-r border-slate-200 text-right font-black text-indigo-900 bg-indigo-50/50">নিট প্রদেয় (Net)</th>
                          <th className="p-2 text-center">স্ট্যাটাস</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {processedMonthRecords.map((rec: SalaryDisbursementRecord, idx: number) => (
                          <tr key={rec.id} className="hover:bg-slate-50/80">
                            <td className="p-2 text-center font-bold text-slate-500 border-r border-slate-100">
                              {toBengaliNumber(idx + 1)}
                            </td>
                            <td className="p-2 font-bold text-slate-900 border-r border-slate-100">
                              <div>{rec.employeeName}</div>
                              <span className="text-[10px] text-slate-500 font-mono">আইডি: {rec.workerId}</span>
                              {rec.isNewJoinerMidMonth && (
                                <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                                  নতুন কর্মী (খণ্ডিত)
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-slate-700 border-r border-slate-100">
                              <div>{rec.designation}</div>
                              <span className="text-[10px] text-slate-500">{rec.department || 'সাধারণ'}</span>
                            </td>
                            <td className="p-2 text-center border-r border-slate-100">
                              <span className="font-bold text-emerald-800">{toBengaliNumber(rec.presentDays)}d</span>
                              {rec.effectivePresentDays !== undefined && rec.effectivePresentDays !== rec.presentDays && (
                                <span className="text-[10px] text-slate-500 block">
                                  কার্যকর: {toBengaliNumber(rec.effectivePresentDays)}d
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-right font-mono text-slate-700 border-r border-slate-100">
                              ৳{formatMoney(rec.salary)}
                            </td>
                            <td className="p-2 text-right font-mono text-indigo-700 border-r border-slate-100">
                              ৳{formatMoney(rec.otPay || 0)}
                            </td>
                            <td className="p-2 text-right font-mono font-black text-indigo-950 bg-indigo-50/40 border-r border-slate-100">
                              ৳{formatMoney(rec.netPayable)}
                            </td>
                            <td className="p-2 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                rec.paymentStatus === 'paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : rec.paymentStatus === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {rec.paymentStatus === 'paid' ? 'পরিশোধিত' : rec.paymentStatus === 'pending' ? 'পেন্ডিং' : 'বকেয়া'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-1">
                  <Receipt className="w-6 h-6 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold text-slate-600">
                    {month} {toBengaliNumber(year)} মাসে এখনও কোনো কর্মচারীর বেতন খাতায় সেভ করা হয়নি
                  </p>
                  <p className="text-[11px] text-slate-400">
                    উপরে কর্মচারীর বেতন হিসাব করে "বেতন খাতায় যোগ করুন" বাটনে চাপলে এখানে স্বয়ংক্রিয়ভাবে সমষ্টি যুক্ত হবে।
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Telegram WebApp Printing Guidance Modal */}
        {showTelegramPrintModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                <Printer className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-black text-slate-900">
                  Telegram Bot-এ সরাসরি প্রিন্ট সাপোর্ট নেই
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  টেলিগ্রামের নিজস্ব অ্যাপ ব্রাউজারে মোবাইল প্রিন্টার ডায়ালগ কাজ করে না। নিচের উপায়ে প্রিন্ট বা স্লিপটি সংরক্ষণ করুন:
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setShowTelegramPrintModal(false);
                    openInExternalBrowser();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition active:scale-95"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>ডিফল্ট ব্রাউজারে খুলুন (প্রিন্ট করতে)</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTelegramPrintModal(false);
                      handleDownloadPDF();
                    }}
                    className="py-2.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF ডাউনলোড</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowTelegramPrintModal(false);
                      handleDownloadImage();
                    }}
                    className="py-2.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileImage className="w-3.5 h-3.5" />
                    <span>HD ছবি সেভ</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowTelegramPrintModal(false);
                    if (calculation) {
                      const text = `টেক্স ওয়ার অ্যাপারেলস - বেতন বিবরণী\nকর্মচারী: ${calculation.employee.name} (${calculation.employee.workerId})\nমাস: ${calculation.month} ${calculation.year}\nনিট বেতন: ${formatMoney(calculation.finalSalary)} টাকা`;
                      shareViaTelegram(text);
                    }
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center gap-1.5 border border-indigo-200 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>টেলিগ্রামে স্লিপ শেয়ার করুন</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTelegramPrintModal(false)}
                  className="w-full py-2 rounded-xl text-slate-500 hover:text-slate-700 font-semibold text-xs text-center cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= 1. SMS SEND MODAL ================= */}
        {showSmsModal && selectedEmployee && calculation && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                  <MessageSquare className="w-4 h-4 text-purple-600" />
                  <span>শ্রমিককে বেতন নোটিশ (SMS) পাঠান</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSmsModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">প্রাপক শ্রমিক</label>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="font-bold text-slate-900">{selectedEmployee.name} ({selectedEmployee.designation})</div>
                    <div className="text-[11px] text-slate-500">আইডি: {selectedEmployee.workerId} • নিট বেতন: {formatMoney(calculation.finalSalary)} ৳</div>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">মোবাইল নম্বর *</label>
                  <input
                    type="text"
                    value={smsRecipientMobile}
                    onChange={(e) => setSmsRecipientMobile(e.target.value)}
                    placeholder="যেমন: 017XXXXXXXX"
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 font-semibold"
                  />
                  {!smsRecipientMobile && (
                    <p className="text-[10px] text-rose-500 mt-0.5">এই শ্রমিকের প্রোফাইলে মোবাইল নম্বর দেওয়া নেই, এখানে লিখুন।</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">SMS বার্তা</label>
                  <textarea
                    rows={3}
                    value={smsCustomMsg}
                    onChange={(e) => setSmsCustomMsg(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 text-xs"
                  />
                </div>

                {!smsSettings.apiKey && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-center justify-between gap-2">
                    <span>⚠️ BulkSMSBD API Key সেট করা নেই</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSmsModal(false);
                        setShowSettingsModal(true);
                      }}
                      className="px-2 py-1 rounded-lg bg-amber-600 text-white font-bold text-[10px] cursor-pointer"
                    >
                      সেটিংস করুন
                    </button>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowSmsModal(false)}
                    className="w-1/3 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition cursor-pointer"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    disabled={isSendingSms}
                    onClick={handleSendSmsToEmployee}
                    className="w-2/3 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingSms ? 'পাঠানো হচ্ছে...' : 'SMS পাঠিয়ে দিন'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= 2. AUTO SMS & TELEGRAM SETTINGS MODAL ================= */}
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-2xl border border-slate-200 space-y-4 my-auto animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 font-black text-slate-800 text-sm">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span>Auto SMS ও Telegram Bot সেটিংস</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 1. Telegram Settings Section */}
              <div className="space-y-2.5 text-xs bg-sky-50/60 p-3 rounded-xl border border-sky-200">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sky-950 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-sky-600" />
                    <span>১. Telegram Bot কনফিগারেশন</span>
                  </h4>
                  <span className="text-[10px] text-sky-700 bg-sky-100/80 px-2 py-0.5 rounded-full font-bold">
                    সরাসরি নোটিফিকেশন
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Telegram Bot Token</label>
                  <div className="relative">
                    <input
                      type={showTgTokenInput ? 'text' : 'password'}
                      value={tgSettings.botToken}
                      onChange={(e) => setTgSettings({ ...tgSettings, botToken: e.target.value })}
                      placeholder="যেমন: 123456789:ABCdefGhIJKlmNoPQRstuVWxyz"
                      className="w-full py-2 pl-2.5 pr-8 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTgTokenInput(!showTgTokenInput)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showTgTokenInput ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Telegram Chat ID</label>
                  <input
                    type="text"
                    value={tgSettings.chatId}
                    onChange={(e) => setTgSettings({ ...tgSettings, chatId: e.target.value })}
                    placeholder="যেমন: 987654321 বা @channel_username"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <button
                  type="button"
                  disabled={isTestingTg}
                  onClick={handleTestTelegramFromModal}
                  className="py-1.5 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                  <span>{isTestingTg ? 'পরীক্ষা হচ্ছে...' : 'Telegram টেস্ট পাঠান'}</span>
                </button>
              </div>

              {/* 2. BulkSMSBD Settings Section */}
              <div className="space-y-2.5 text-xs bg-purple-50/60 p-3 rounded-xl border border-purple-200">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-purple-950 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                    <span>২. BulkSMSBD (Auto SMS) API কনফিগারেশন</span>
                  </h4>
                  <span className="text-[10px] text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-full font-bold">
                    বাংলাদেশি SMS গেটওয়ে
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">API URL</label>
                    <input
                      type="text"
                      value={smsSettings.apiUrl}
                      onChange={(e) => setSmsSettings({ ...smsSettings, apiUrl: e.target.value })}
                      placeholder="https://api.bulksmsbd.net/api/smsapi"
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">API Key</label>
                    <input
                      type="password"
                      value={smsSettings.apiKey}
                      onChange={(e) => setSmsSettings({ ...smsSettings, apiKey: e.target.value })}
                      placeholder="BulkSMSBD API Key"
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Sender ID (ঐচ্ছিক)</label>
                    <input
                      type="text"
                      value={smsSettings.senderId}
                      onChange={(e) => setSmsSettings({ ...smsSettings, senderId: e.target.value })}
                      placeholder="TexWare / Non-Masking"
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">HTTP Method</label>
                    <select
                      value={smsSettings.method}
                      onChange={(e) => setSmsSettings({ ...smsSettings, method: e.target.value as 'GET' | 'POST' })}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettingsFromModal}
                  className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>সেটিংস সেভ করুন (Save)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= 3. ATTENDANCE & IN-OUT HISTORY MODAL ================= */}
        {showAttendanceHistoryModal && targetEmpForHistory && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-auto animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 flex-wrap">
                      <span>দৈনিক ইন-আউট টাইম ও উপস্থিতির হিস্ট্রি</span>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold border border-blue-200">
                        {targetEmpForHistory.name} (আইডি: {targetEmpForHistory.workerId})
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      {targetEmpForHistory.designation} • {targetEmpForHistory.department || 'সাধারণ সেকশন'} • সকল ইন/আউট পঞ্চ, লেট মিনিট ও ওটি হিস্ট্রি
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={targetEmpForHistory.id}
                    onChange={(e) => {
                      setSelectedHistoryEmpId(e.target.value);
                      setSelectedId(e.target.value);
                    }}
                    className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.workerId})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAttendanceHistoryModal(false)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Attendance Profile View */}
              <EmployeeAttendanceProfileView
                employee={targetEmpForHistory}
                records={attendanceRecords}
                showToast={showToast}
                allowQuickMark={false}
              />

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowAttendanceHistoryModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition active:scale-95"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Contract Letter Modal (Worker Appointment Agreement) */}
        {contractLetterEmp && (
          <ContractLetterModal
            employee={contractLetterEmp}
            isOpen={Boolean(contractLetterEmp)}
            onClose={() => setContractLetterEmp(null)}
            onEmployeeUpdated={(updatedEmp) => {
              setContractLetterEmp(updatedEmp);
            }}
            showToast={showToast}
          />
        )}
    </div>
  );
};
