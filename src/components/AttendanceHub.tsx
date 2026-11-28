import React, { useState, useEffect, useRef } from 'react';
import { Employee, AttendanceRecord, AttendanceStatus, ShiftSettings } from '../types';
import {
  saveOrUpdateAttendanceRecord,
  saveBulkAttendanceRecords,
  deleteAttendanceRecordById,
  deleteBulkAttendanceRecords,
  deleteAllAttendanceRecords,
  loadShiftSettings,
  saveShiftSettings,
  isDemoEmployee,
  isDemoAttendanceRecord,
  purgeAllDemoData
} from '../lib/firebase';
import {
  DEFAULT_SHIFT_SETTINGS,
  getTodayDateString,
  calculateAttendanceMetrics,
  getAttendanceStatusBadge,
  formatTime12h,
  coerceTimePeriod,
  minutesToTimeString,
  timeStringToMinutes,
  calculateFridayBreakDeductionMinutes,
  isFriday,
  getBengaliDayName
} from '../lib/attendanceUtils';
import { formatDateBn, toBengaliNumber } from '../lib/utils';
import { printElement } from '../lib/printer';
import { WorkerMonthlyAttendanceModal } from './WorkerMonthlyAttendanceModal';
import {
  Calendar,
  Clock,
  UserCheck,
  UserX,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Printer,
  Search,
  Filter,
  Trash2,
  Save,
  Check,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Sparkles,
  Coffee,
  HelpCircle,
  FileSpreadsheet,
  Users
} from 'lucide-react';

interface AttendanceHubProps {
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  showToast: (msg: string) => void;
  onViewEmployeeProfile?: (employeeId: string) => void;
}

export const AttendanceHub: React.FC<AttendanceHubProps> = ({
  employees,
  attendanceRecords,
  showToast,
  onViewEmployeeProfile,
}) => {
  // Current selected attendance date
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  // Sub-view: 'roster' (দৈনিক হাজিরা এন্ট্রি) or 'records' (হাজিরা শিট ও ইতিহাস)
  const [subView, setSubView] = useState<'roster' | 'records'>('roster');

  // Shift settings
  const [shiftSettings, setShiftSettings] = useState<ShiftSettings>(DEFAULT_SHIFT_SETTINGS);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [tempShift, setTempShift] = useState<ShiftSettings>(DEFAULT_SHIFT_SETTINGS);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus | 'unmarked'>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  // Local draft inputs for selectedDate to provide snappy, responsive editing
  // Key: employeeId -> partial AttendanceRecord
  const [dailyDrafts, setDailyDrafts] = useState<Record<string, {
    status: AttendanceStatus;
    inTime: string;
    outTime: string;
    otHours: number;
    note: string;
    saved: boolean;
  }>>({});

  // Single Worker Quick Attendance & OT Entry Modal State
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [singleEmpId, setSingleEmpId] = useState('');
  const [singleDate, setSingleDate] = useState(selectedDate);
  const [singleStatus, setSingleStatus] = useState<AttendanceStatus>('present');
  const [singleInTime, setSingleInTime] = useState('08:00');
  const [singleOutTime, setSingleOutTime] = useState('17:00');
  const [singleOtHours, setSingleOtHours] = useState<number>(0);
  const [singleNote, setSingleNote] = useState('');
  const [singleSearch, setSingleSearch] = useState('');
  const [isSavingSingleModal, setIsSavingSingleModal] = useState(false);

  // History Tab Filters
  const [historyEmpId, setHistoryEmpId] = useState<string>('all');
  const [historyMonth, setHistoryMonth] = useState<string>('all');
  const [historyYear, setHistoryYear] = useState<number>(new Date().getFullYear());
  const [historyStatus, setHistoryStatus] = useState<string>('all');
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);

  // One-click delete report modals
  const [showDeleteReportModal, setShowDeleteReportModal] = useState<boolean>(false);
  const [showDeleteDayModal, setShowDeleteDayModal] = useState<boolean>(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState<boolean>(false);
  const [isDeletingReport, setIsDeletingReport] = useState<boolean>(false);

  // Writing comment tracking (hides print options and prevents print popups while typing comments)
  const [isWritingComment, setIsWritingComment] = useState<boolean>(false);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Prevent print dialog shortcuts (Ctrl+P / Cmd+P) when user is writing comments or focusing inputs
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

  // Load shift settings
  useEffect(() => {
    loadShiftSettings().then((settings) => {
      setShiftSettings(settings);
      setTempShift(settings);
    });
    // নিশ্চিত করুন কোনো ডেমো কর্মী বা ডেমো হাজিরা ডাটাবেজে নেই
    purgeAllDemoData().catch(() => {});
  }, []);

  // Filter active employees (সম্পূর্ণ ডেমো মুক্ত প্রকৃত কারখানা কর্মী)
  const activeEmployees = employees.filter((e) => e.status === 'active' && !isDemoEmployee(e));

  // Available departments
  const departments = Array.from(
    new Set(activeEmployees.map((e) => e.department).filter(Boolean))
  ) as string[];

  // Sync dailyDrafts whenever selectedDate or attendanceRecords change
  useEffect(() => {
    const isFri = isFriday(selectedDate);
    const drafts: Record<string, {
      status: AttendanceStatus;
      inTime: string;
      outTime: string;
      otHours: number;
      note: string;
      saved: boolean;
    }> = {};

    activeEmployees.forEach((emp) => {
      const existing = attendanceRecords.find(
        (r) => (r.employeeId === emp.id || r.workerId === emp.workerId) && r.date === selectedDate
      );
      if (existing) {
        drafts[emp.id] = {
          status: isFri ? 'holiday' : existing.status,
          inTime: existing.inTime || '',
          outTime: existing.outTime || '',
          otHours: typeof existing.otHours === 'number' ? existing.otHours : 0,
          note: existing.note || '',
          saved: true,
        };
      } else {
        drafts[emp.id] = {
          status: isFri ? 'holiday' : 'present',
          inTime: '',
          outTime: '',
          otHours: 0,
          note: '',
          saved: false,
        };
      }
    });

    setDailyDrafts(drafts);
  }, [selectedDate, attendanceRecords, employees]);

  // Navigate date
  const changeDateBy = (offset: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + offset);
    const nextY = dateObj.getFullYear();
    const nextM = String(dateObj.getMonth() + 1).padStart(2, '0');
    const nextD = String(dateObj.getDate()).padStart(2, '0');
    setSelectedDate(`${nextY}-${nextM}-${nextD}`);
  };

  const setDateToToday = () => {
    setSelectedDate(getTodayDateString());
  };

  // Helper to get current HH:mm
  const getCurrentTimeString = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  // Default AM time for empty In-Time inputs and default PM time for empty Out-Time inputs
  const getDefaultAmInTime = () => {
    const mins = timeStringToMinutes(shiftSettings.standardInTime);
    return mins !== null && mins < 720 ? shiftSettings.standardInTime : '08:00';
  };

  const getDefaultPmOutTime = () => {
    const mins = timeStringToMinutes(shiftSettings.standardOutTime);
    return mins !== null && mins >= 720 ? shiftSettings.standardOutTime : '17:00';
  };

  // Update a single draft property
  const handleUpdateDraft = (
    empId: string,
    field: 'status' | 'inTime' | 'outTime' | 'otHours' | 'note',
    value: any,
    options?: { preserveExact?: boolean }
  ) => {
    const isFri = isFriday(selectedDate);
    setDailyDrafts((prev) => {
      const current = prev[empId] || {
        status: isFri ? 'holiday' : 'present',
        inTime: '',
        outTime: '',
        otHours: 0,
        note: '',
        saved: false,
      };

      let normalizedValue = value;
      if (!options?.preserveExact && typeof value === 'string' && value) {
        if (field === 'inTime' && !current.inTime) {
          normalizedValue = coerceTimePeriod(value, 'AM');
        } else if (field === 'outTime' && !current.outTime) {
          normalizedValue = coerceTimePeriod(value, 'PM');
        }
      }

      const updated = {
        ...current,
        [field]: normalizedValue,
        saved: false,
      };

      // Automatically calculate overtime and update attendance status
      if (field === 'inTime' || field === 'outTime') {
        const effectiveIn = field === 'inTime' ? normalizedValue : current.inTime;
        const effectiveOut = field === 'outTime' ? normalizedValue : current.outTime;

        if (isFri) {
          updated.status = 'holiday';
          // On Friday: Calculate overtime whenever inTime or outTime is entered
          const metrics = calculateAttendanceMetrics(effectiveIn, effectiveOut, shiftSettings, selectedDate);
          if (effectiveIn && effectiveOut) {
            updated.otHours = metrics.otHours;
          } else if (effectiveOut) {
            updated.otHours = metrics.otHours;
          }
        } else {
          // Regular work days:
          // 1. Check if late
          if (effectiveIn) {
            const metrics = calculateAttendanceMetrics(effectiveIn, effectiveOut, shiftSettings, selectedDate);
            if (metrics.isLate && current.status === 'present') {
              updated.status = 'late';
            } else if (!metrics.isLate && current.status === 'late') {
              updated.status = 'present';
            }
          }

          // 2. Automatically calculate suggested OT hours whenever either inTime or outTime changes!
          if (effectiveOut) {
            const metrics = calculateAttendanceMetrics(effectiveIn, effectiveOut, shiftSettings, selectedDate);
            updated.otHours = metrics.otHours;
          }
        }
      }

      return {
        ...prev,
        [empId]: updated,
      };
    });
  };

  // Quick OT increment / setter helpers
  const handleSetOtHours = (empId: string, hours: number) => {
    handleUpdateDraft(empId, 'otHours', Math.max(0, Math.round(hours * 10) / 10));
  };

  const handleAddOtHours = (empId: string, addAmount: number) => {
    const current = dailyDrafts[empId]?.otHours || 0;
    handleUpdateDraft(empId, 'otHours', Math.max(0, Math.round((current + addAmount) * 10) / 10));
  };

  // Save single employee attendance record
  const handleSaveSingle = async (emp: Employee) => {
    const draft = dailyDrafts[emp.id];
    if (!draft) return;

    const isFri = isFriday(selectedDate);
    const metrics = calculateAttendanceMetrics(draft.inTime, draft.outTime, shiftSettings, selectedDate);

    let finalStatus: AttendanceStatus = draft.status;
    let finalOt = typeof draft.otHours === 'number' ? draft.otHours : metrics.otHours;

    if (isFri) {
      // Friday: Factory is closed, only overtime is counted, never attendance!
      finalStatus = 'holiday';
      if (finalOt === 0 && metrics.otHours > 0) {
        finalOt = metrics.otHours;
      }
    } else {
      if (finalStatus === 'present' && metrics.isLate) {
        finalStatus = 'late';
      }
      if (finalStatus === 'absent' || finalStatus === 'leave') {
        finalOt = 0;
      }
    }

    try {
      await saveOrUpdateAttendanceRecord({
        employeeId: emp.id,
        workerId: emp.workerId,
        employeeName: emp.name,
        department: emp.department,
        date: selectedDate,
        status: finalStatus,
        inTime: (finalStatus === 'absent' || finalStatus === 'leave') ? '' : (draft.inTime || ''),
        outTime: (finalStatus === 'absent' || finalStatus === 'leave') ? '' : (draft.outTime || ''),
        shiftStart: shiftSettings.standardInTime,
        shiftEnd: shiftSettings.standardOutTime,
        isLate: isFri ? false : metrics.isLate,
        lateMinutes: isFri ? 0 : metrics.lateMinutes,
        otHours: finalOt,
        note: draft.note || (isFri && finalOt > 0 ? 'শুক্রবার ওটি ডিউটি' : ''),
      });

      setDailyDrafts((prev) => ({
        ...prev,
        [emp.id]: {
          ...prev[emp.id],
          status: finalStatus,
          otHours: finalOt,
          saved: true,
        },
      }));

      if (isFri) {
        showToast(
          finalOt > 0
            ? `✓ ${emp.name}-এর শুক্রবারের ${finalOt} ঘণ্টা ওটি সংরক্ষিত হয়েছে (হাজিরা গণনা হয়নি)`
            : `✓ ${emp.name}-এর শুক্রবার সাপ্তাহিক ছুটি সংরক্ষিত হয়েছে`
        );
      } else {
        showToast(`✓ ${emp.name} এর হাজিরা ও ${finalOt > 0 ? `${finalOt} ঘণ্টা ওটি` : ''} সংরক্ষিত হয়েছে`);
      }
    } catch (e) {
      showToast('সংরক্ষণ ব্যর্থ হয়েছে');
    }
  };

  // Bulk mark all active as present with standard in-time
  const handleBulkMarkAllPresent = async () => {
    const isFri = isFriday(selectedDate);
    if (isFri) {
      showToast('⚠️ শুক্রবার কারখানা সাপ্তাহিক বন্ধ। আজ সাধারণ হাজিরা দেওয়া যাবে না, শুধুমাত্র ওটি ডিউটি এন্ট্রি করা যাবে।');
      return;
    }

    const recordsToSave: AttendanceRecord[] = activeEmployees.map((emp) => {
      const currentDraft = dailyDrafts[emp.id];
      const inTime = currentDraft?.inTime || shiftSettings.standardInTime;
      const outTime = currentDraft?.outTime || shiftSettings.standardOutTime;
      const metrics = calculateAttendanceMetrics(inTime, outTime, shiftSettings, selectedDate);
      const otValue = typeof currentDraft?.otHours === 'number' ? currentDraft.otHours : metrics.otHours;

      return {
        id: `att_${emp.id}_${selectedDate}`,
        employeeId: emp.id,
        workerId: emp.workerId,
        employeeName: emp.name,
        department: emp.department,
        date: selectedDate,
        status: metrics.isLate ? 'late' : 'present',
        inTime,
        outTime,
        shiftStart: shiftSettings.standardInTime,
        shiftEnd: shiftSettings.standardOutTime,
        isLate: metrics.isLate,
        lateMinutes: metrics.lateMinutes,
        otHours: otValue,
        note: currentDraft?.note || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    });

    try {
      await saveBulkAttendanceRecords(recordsToSave);
      showToast(`সকল ${activeEmployees.length} জন কর্মীকে উপস্থিত করা হয়েছে`);
    } catch (e) {
      showToast('বাল্ক হাজিরা সংরক্ষণে সমস্যা হয়েছে');
    }
  };

  // Open single worker entry modal
  const handleOpenSingleModal = (empId?: string) => {
    const targetEmpId = empId || (activeEmployees.length > 0 ? activeEmployees[0].id : '');
    setSingleEmpId(targetEmpId);
    setSingleDate(selectedDate);

    const isSingleFri = isFriday(selectedDate);
    const existing = attendanceRecords.find(
      (r) => (r.employeeId === targetEmpId || r.workerId === targetEmpId) && r.date === selectedDate
    );

    if (existing) {
      setSingleStatus(isSingleFri ? 'holiday' : existing.status);
      const inVal = existing.inTime || shiftSettings.standardInTime;
      const outVal = existing.outTime || shiftSettings.standardOutTime;
      setSingleInTime(inVal);
      setSingleOutTime(outVal);
      setSingleOtHours(
        typeof existing.otHours === 'number'
          ? existing.otHours
          : calculateAttendanceMetrics(inVal, outVal, shiftSettings, selectedDate).otHours
      );
      setSingleNote(existing.note || '');
    } else {
      setSingleStatus(isSingleFri ? 'holiday' : 'present');
      setSingleInTime(shiftSettings.standardInTime);
      setSingleOutTime(shiftSettings.standardOutTime);
      const metrics = calculateAttendanceMetrics(shiftSettings.standardInTime, shiftSettings.standardOutTime, shiftSettings, selectedDate);
      setSingleOtHours(metrics.otHours);
      setSingleNote('');
    }

    setSingleSearch('');
    setShowSingleModal(true);
  };

  // When changing employee in single worker modal, auto-load their existing record or defaults
  const handleSelectSingleEmployee = (empId: string) => {
    setSingleEmpId(empId);
    const isSingleFri = isFriday(singleDate);
    const existing = attendanceRecords.find(
      (r) => (r.employeeId === empId || r.workerId === empId) && r.date === singleDate
    );

    if (existing) {
      setSingleStatus(isSingleFri ? 'holiday' : existing.status);
      const inVal = existing.inTime || shiftSettings.standardInTime;
      const outVal = existing.outTime || shiftSettings.standardOutTime;
      setSingleInTime(inVal);
      setSingleOutTime(outVal);
      setSingleOtHours(
        typeof existing.otHours === 'number'
          ? existing.otHours
          : calculateAttendanceMetrics(inVal, outVal, shiftSettings, singleDate).otHours
      );
      setSingleNote(existing.note || '');
    } else {
      setSingleStatus(isSingleFri ? 'holiday' : 'present');
      setSingleInTime(shiftSettings.standardInTime);
      setSingleOutTime(shiftSettings.standardOutTime);
      const metrics = calculateAttendanceMetrics(shiftSettings.standardInTime, shiftSettings.standardOutTime, shiftSettings, singleDate);
      setSingleOtHours(metrics.otHours);
      setSingleNote('');
    }
  };

  // Save from single worker modal
  const handleSaveSingleModal = async () => {
    const targetEmp = employees.find((e) => e.id === singleEmpId);
    if (!targetEmp) {
      showToast('অনুগ্রহ করে কর্মী নির্বাচন করুন');
      return;
    }

    setIsSavingSingleModal(true);
    const isSingleFri = isFriday(singleDate);
    const metrics = calculateAttendanceMetrics(singleInTime, singleOutTime, shiftSettings, singleDate);
    let finalStatus: AttendanceStatus = singleStatus;
    let otValue = typeof singleOtHours === 'number' ? singleOtHours : metrics.otHours;

    if (isSingleFri) {
      finalStatus = 'holiday';
      if (otValue === 0 && metrics.otHours > 0) {
        otValue = metrics.otHours;
      }
    } else {
      if (finalStatus === 'present' && metrics.isLate) {
        finalStatus = 'late';
      }
      if (finalStatus === 'absent' || finalStatus === 'leave') {
        otValue = 0;
      }
    }

    try {
      await saveOrUpdateAttendanceRecord({
        employeeId: targetEmp.id,
        workerId: targetEmp.workerId,
        employeeName: targetEmp.name,
        department: targetEmp.department,
        date: singleDate,
        status: finalStatus,
        inTime: finalStatus === 'absent' || finalStatus === 'leave' ? '' : (singleInTime || ''),
        outTime: finalStatus === 'absent' || finalStatus === 'leave' ? '' : (singleOutTime || ''),
        shiftStart: shiftSettings.standardInTime,
        shiftEnd: shiftSettings.standardOutTime,
        isLate: isSingleFri ? false : metrics.isLate,
        lateMinutes: isSingleFri ? 0 : metrics.lateMinutes,
        otHours: otValue,
        note: singleNote.trim() || (isSingleFri && otValue > 0 ? 'শুক্রবার ওটি ডিউটি' : ''),
      });

      // Update dailyDrafts if on the same date
      if (singleDate === selectedDate) {
        setDailyDrafts((prev) => ({
          ...prev,
          [targetEmp.id]: {
            status: finalStatus,
            inTime: singleInTime,
            outTime: singleOutTime,
            otHours: otValue,
            note: singleNote,
            saved: true,
          },
        }));
      }

      if (isSingleFri) {
        showToast(
          otValue > 0
            ? `✓ ${targetEmp.name}-এর ${formatDateBn(singleDate)} (শুক্রবার) তারিখের ${otValue} ঘণ্টা ওটি সংরক্ষিত হয়েছে (হাজিরা গণনা হয়নি)`
            : `✓ ${targetEmp.name}-এর ${formatDateBn(singleDate)} (শুক্রবার) সাপ্তাহিক ছুটি সংরক্ষিত হয়েছে`
        );
      } else {
        showToast(`✓ ${targetEmp.name}-এর ${formatDateBn(singleDate)} তারিখের হাজিরা ও ${otValue > 0 ? `${otValue} ঘণ্টা ওটি` : ''} সফলভাবে সংরক্ষিত হয়েছে`);
      }
      setShowSingleModal(false);
    } catch (err) {
      showToast('হাজিরা সংরক্ষণ সম্ভব হয়নি');
    } finally {
      setIsSavingSingleModal(false);
    }
  };

  // Quick fill current time as In-Time or Out-Time
  const handleQuickTime = (empId: string, field: 'inTime' | 'outTime') => {
    const nowTime = getCurrentTimeString();
    handleUpdateDraft(empId, field, nowTime, { preserveExact: true });
  };

  // Save Shift Settings Modal
  const handleSaveShiftSettings = async () => {
    await saveShiftSettings(tempShift);
    setShiftSettings(tempShift);
    setShowShiftModal(false);
    showToast('শিফট টাইমিং সফলভাবে আপডেট হয়েছে');
  };

  // Print Daily Attendance Sheet
  const handlePrintAttendanceSheet = () => {
    if (!printAreaRef.current) return;
    printElement(printAreaRef.current, `TexWare_Attendance_${selectedDate}`);
  };

  // KPI calculations for selected date (শুধুমাত্র বাস্তব উপস্থিতি, ডেমো বাদ)
  const isSelectedFri = isFriday(selectedDate);
  const recordsForSelectedDate = attendanceRecords.filter((r) => r.date === selectedDate && !isDemoAttendanceRecord(r));

  // On Friday: Weekly holiday! Regular attendance is 0! All duty is strictly OT!
  const presentCount = isSelectedFri ? 0 : recordsForSelectedDate.filter(
    (r) => !isFriday(r.date) && (r.status === 'present' || r.status === 'late' || r.status === 'half_day')
  ).length;

  const fridayOtWorkersCount = isSelectedFri
    ? recordsForSelectedDate.filter((r) => (r.otHours && r.otHours > 0) || (r.inTime && r.outTime)).length
    : 0;

  const lateCount = isSelectedFri ? 0 : recordsForSelectedDate.filter((r) => !isFriday(r.date) && (r.status === 'late' || r.isLate)).length;
  const absentCount = isSelectedFri ? 0 : recordsForSelectedDate.filter((r) => !isFriday(r.date) && r.status === 'absent').length;
  const leaveCount = recordsForSelectedDate.filter((r) => r.status === 'leave').length;
  const totalOtHoursToday = recordsForSelectedDate.reduce((sum, r) => sum + (r.otHours || 0), 0);
  const recordedCount = recordsForSelectedDate.length;

  // Filtered employees for the roster view
  const filteredEmployees = activeEmployees.filter((emp) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        emp.name.toLowerCase().includes(q) ||
        emp.workerId.toLowerCase().includes(q) ||
        (emp.department && emp.department.toLowerCase().includes(q));
      if (!match) return false;
    }

    // Department filter
    if (departmentFilter !== 'all' && emp.department !== departmentFilter) {
      return false;
    }

    // Status filter
    if (statusFilter !== 'all') {
      const existing = recordsForSelectedDate.find((r) => r.employeeId === emp.id || (emp.workerId && r.workerId === emp.workerId));
      if (statusFilter === 'unmarked') {
        if (existing) return false;
      } else {
        if (!existing || existing.status !== statusFilter) return false;
      }
    }

    return true;
  });

  // History filtered records (ডেমো রেকর্ড বাদ)
  const filteredHistoryRecords = attendanceRecords
    .filter((rec) => !isDemoAttendanceRecord(rec))
    .filter((rec) => {
    if (historyEmpId !== 'all') {
      const targetEmp = employees.find((e) => e.id === historyEmpId);
      const isMatch =
        rec.employeeId === historyEmpId ||
        (targetEmp && (
          rec.employeeId === targetEmp.workerId ||
          rec.workerId === targetEmp.workerId ||
          (rec.employeeName && targetEmp.name && rec.employeeName.trim() === targetEmp.name.trim())
        ));
      if (!isMatch) return false;
    }
    if (historyStatus !== 'all') {
      if (historyStatus === 'friday_ot') {
        if (!isFriday(rec.date) || !(rec.otHours && rec.otHours > 0)) return false;
      } else {
        const effectiveStatus = isFriday(rec.date) ? 'holiday' : rec.status;
        if (effectiveStatus !== historyStatus) return false;
      }
    }
    if (historyYear && !rec.date.startsWith(`${historyYear}`)) return false;
    if (historyMonth && historyMonth !== 'all') {
      const targetPrefix = `${historyYear}-${historyMonth}`;
      if (!rec.date.startsWith(targetPrefix)) return false;
    }
    return true;
  });

  const handleDeleteHistoryRecord = async (id: string) => {
    try {
      await deleteAttendanceRecordById(id);
      setDeleteRecordId(null);
      showToast('হাজিরা রেকর্ড মুছে ফেলা হয়েছে');
    } catch (e) {
      showToast('ডিলিট করতে সমস্যা হয়েছে');
    }
  };

  // 1-Click Delete Filtered Attendance Report
  const handleOneClickDeleteFilteredReport = async () => {
    if (filteredHistoryRecords.length === 0) {
      showToast('মুছে ফেলার জন্য কোনো হাজিরা রেকর্ড নেই');
      return;
    }
    setIsDeletingReport(true);
    try {
      const ids = filteredHistoryRecords.map((r) => r.id);
      await deleteBulkAttendanceRecords(ids);
      setShowDeleteReportModal(false);
      showToast(`সফলভাবে ${ids.length} টি হাজিরা রেকর্ড এক ক্লিকে মুছে ফেলা হয়েছে`);
    } catch (e) {
      console.error(e);
      showToast('হাজিরা রিপোর্ট মুছতে সমস্যা হয়েছে');
    } finally {
      setIsDeletingReport(false);
    }
  };

  // 1-Click Delete Selected Date Attendance Report
  const handleOneClickDeleteDayReport = async () => {
    if (recordsForSelectedDate.length === 0) {
      showToast('এই দিনের কোনো সংরক্ষিত হাজিরা রেকর্ড নেই');
      return;
    }
    setIsDeletingReport(true);
    try {
      const ids = recordsForSelectedDate.map((r) => r.id);
      await deleteBulkAttendanceRecords(ids);
      // Reset drafts
      const resetDrafts: typeof dailyDrafts = { ...dailyDrafts };
      activeEmployees.forEach((emp) => {
        resetDrafts[emp.id] = {
          status: 'present',
          inTime: '',
          outTime: '',
          otHours: 0,
          note: '',
          saved: false,
        };
      });
      setDailyDrafts(resetDrafts);
      setShowDeleteDayModal(false);
      showToast(`${formatDateBn(selectedDate)}-এর ${ids.length} টি হাজিরা রেকর্ড এক ক্লিকে মুছে ফেলা হয়েছে`);
    } catch (e) {
      console.error(e);
      showToast('দৈনিক হাজিরা মুছতে সমস্যা হয়েছে');
    } finally {
      setIsDeletingReport(false);
    }
  };

  // 1-Click Delete ALL Attendance Records Across the Entire System
  const handleDeleteAllAttendance = async () => {
    setIsDeletingReport(true);
    try {
      const count = await deleteAllAttendanceRecords();
      // Reset daily drafts
      const resetDrafts: typeof dailyDrafts = { ...dailyDrafts };
      activeEmployees.forEach((emp) => {
        resetDrafts[emp.id] = {
          status: 'present',
          inTime: '',
          outTime: '',
          otHours: 0,
          note: '',
          saved: false,
        };
      });
      setDailyDrafts(resetDrafts);
      setShowDeleteAllModal(false);
      showToast(`মোট ${toBengaliNumber(count)} টি হাজিরা রেকর্ড এক ক্লিকে সম্পূর্ণ মুছে ফেলা হয়েছে`);
    } catch (e) {
      console.error(e);
      showToast('হাজিরা ডেটা মুছতে সমস্যা হয়েছে');
    } finally {
      setIsDeletingReport(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Date Control */}
      <div className="bg-gradient-to-r from-[#08142E] via-[#0F2149] to-[#132B63] text-white rounded-2xl p-4 sm:p-5 border border-[#162752] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3.5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-400 to-teal-500 text-slate-950 flex items-center justify-center shrink-0 shadow-md">
              <Clock className="w-5 h-5 stroke-[2.25]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                দৈনিক হাজিরা ও টাইম কন্ট্রোল
              </h2>
              <p className="text-xs text-blue-200/80">
                শ্রমিকদের ইন টাইম, আউট টাইম, লেট ও ওভারটাইম রিয়েল-টাইম ট্র্যাকিং
              </p>
            </div>
          </div>

          {/* Sub Navigation Toggle */}
          <div className="flex items-center gap-1 p-1 bg-[#0B1736] rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setSubView('roster')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                subView === 'roster'
                  ? 'bg-gradient-to-r from-[#1D63DC] to-[#2563EB] text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              দৈনিক হাজিরা এন্ট্রি
            </button>
            <button
              type="button"
              onClick={() => setSubView('records')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                subView === 'records'
                  ? 'bg-gradient-to-r from-[#1D63DC] to-[#2563EB] text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              হাজিরা রেকর্ড ও রিপোর্ট
            </button>
          </div>
        </div>

        {/* Date Selector & Shift Overview Bar */}
        <div className="pt-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Date Picker Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-white text-slate-900 border border-white/20 rounded-xl p-1 shadow-xs">
              <button
                type="button"
                onClick={() => changeDateBy(-1)}
                title="আগের দিন"
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 px-2">
                <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-xs font-bold font-mono text-slate-900 outline-none cursor-pointer"
                />
              </div>
              <button
                type="button"
                onClick={() => changeDateBy(1)}
                title="পরের দিন"
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {selectedDate !== getTodayDateString() && (
              <button
                type="button"
                onClick={setDateToToday}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors cursor-pointer shadow-xs"
              >
                আজকের দিনে যান
              </button>
            )}

            <span className="text-xs font-medium text-blue-200 hidden sm:inline">
              তারিখ: <strong className="text-white">{formatDateBn(selectedDate)}</strong>
            </span>
          </div>

          {/* Shift Info & Change Settings Button */}
          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0B1736] border border-white/15 text-xs">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-blue-200">শিফট:</span>
              <strong className="text-white font-mono tabular-nums">
                {formatTime12h(shiftSettings.standardInTime)} - {formatTime12h(shiftSettings.standardOutTime)}
              </strong>
              <span className="text-[10px] text-blue-300/80">
                (গ্রেস {shiftSettings.graceMinutes} মি.)
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowShiftModal(true)}
              title="শিফটের সময় পরিবর্তন"
              className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-300" />
              <span className="hidden sm:inline">শিফট কন্ট্রোল</span>
            </button>

            {!isWritingComment && (
              <button
                type="button"
                onClick={handlePrintAttendanceSheet}
                className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 transition-all cursor-pointer text-xs font-extrabold flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>প্রিন্ট শিট</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stats Bar for Selected Date */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Active */}
        <div className="relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-[#635BFF] to-[#4338CA] text-white shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-medium text-white/85">মোট সক্রিয় কর্মী</div>
              <div className="text-xl font-extrabold font-mono text-white mt-1 tabular-nums tracking-tight">
                {toBengaliNumber(activeEmployees.length)} <span className="text-xs font-sans font-medium text-white/80">জন</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-white/15 border border-white/15 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="text-[10.5px] text-white/85 mt-2 tabular-nums">
            {isSelectedFri
              ? `ওটি এন্ট্রি: ${toBengaliNumber(fridayOtWorkersCount)}/${toBengaliNumber(activeEmployees.length)}`
              : `হাজিরা এন্ট্রি: ${toBengaliNumber(recordedCount)}/${toBengaliNumber(activeEmployees.length)}`}
          </div>
        </div>

        {/* Present */}
        <div className={`relative overflow-hidden rounded-xl p-4 flex flex-col justify-between shadow-sm ${
          isSelectedFri
            ? 'bg-slate-200/80 text-slate-700 border border-slate-300'
            : 'bg-gradient-to-br from-[#059669] to-[#16A34A] text-white'
        }`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className={`text-[11px] font-medium ${isSelectedFri ? 'text-slate-600' : 'text-white/85'}`}>
                উপস্থিত
              </div>
              <div className={`text-xl font-extrabold font-mono mt-1 tabular-nums tracking-tight ${
                isSelectedFri ? 'text-slate-700' : 'text-white'
              }`}>
                {toBengaliNumber(presentCount)} <span className={`text-xs font-sans font-medium ${isSelectedFri ? 'text-slate-500' : 'text-white/80'}`}>জন</span>
              </div>
            </div>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              isSelectedFri ? 'bg-slate-300/70 text-slate-600' : 'bg-white/15 border border-white/15 text-white'
            }`}>
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-[10.5px] mt-2 tabular-nums ${isSelectedFri ? 'text-slate-600' : 'text-white/85'}`}>
            {isSelectedFri ? 'শুক্রবার বন্ধ (হাজিরা নেই)' : `${activeEmployees.length > 0 ? Math.round((presentCount / activeEmployees.length) * 100) : 0}% উপস্থিতির হার`}
          </div>
        </div>

        {/* Late */}
        <div className={`relative overflow-hidden rounded-xl p-4 flex flex-col justify-between shadow-sm ${
          isSelectedFri
            ? 'bg-slate-200/80 text-slate-700 border border-slate-300'
            : 'bg-gradient-to-br from-[#F97316] to-[#EA580C] text-white'
        }`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className={`text-[11px] font-medium ${isSelectedFri ? 'text-slate-600' : 'text-white/85'}`}>
                বিলম্ব / লেট
              </div>
              <div className={`text-xl font-extrabold font-mono mt-1 tabular-nums tracking-tight ${
                isSelectedFri ? 'text-slate-700' : 'text-white'
              }`}>
                {toBengaliNumber(lateCount)} <span className={`text-xs font-sans font-medium ${isSelectedFri ? 'text-slate-500' : 'text-white/80'}`}>জন</span>
              </div>
            </div>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              isSelectedFri ? 'bg-slate-300/70 text-slate-600' : 'bg-white/15 border border-white/15 text-white'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-[10.5px] mt-2 ${isSelectedFri ? 'text-slate-600' : 'text-white/85'}`}>
            {isSelectedFri ? 'সাপ্তাহিক বন্ধ (লেট নেই)' : 'নির্ধারিত সময়ের পরে প্রবেশ'}
          </div>
        </div>

        {/* Absent */}
        <div className={`relative overflow-hidden rounded-xl p-4 flex flex-col justify-between shadow-sm ${
          isSelectedFri
            ? 'bg-slate-200/80 text-slate-700 border border-slate-300'
            : 'bg-gradient-to-br from-[#EC4899] to-[#DB2777] text-white'
        }`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className={`text-[11px] font-medium ${isSelectedFri ? 'text-slate-600' : 'text-white/85'}`}>
                অনুপস্থিত
              </div>
              <div className={`text-xl font-extrabold font-mono mt-1 tabular-nums tracking-tight ${
                isSelectedFri ? 'text-slate-700' : 'text-white'
              }`}>
                {toBengaliNumber(absentCount)} <span className={`text-xs font-sans font-medium ${isSelectedFri ? 'text-slate-500' : 'text-white/80'}`}>জন</span>
              </div>
            </div>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              isSelectedFri ? 'bg-slate-300/70 text-slate-600' : 'bg-white/15 border border-white/15 text-white'
            }`}>
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-[10.5px] mt-2 ${isSelectedFri ? 'text-slate-600' : 'text-white/85'}`}>
            {isSelectedFri ? 'সাপ্তাহিক ছুটি' : 'আজ কাজে যোগ দেননি'}
          </div>
        </div>

        {/* Leave */}
        <div className="relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-[#0284C7] to-[#2563EB] text-white shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-medium text-white/85">ছুটিতে</div>
              <div className="text-xl font-extrabold font-mono text-white mt-1 tabular-nums tracking-tight">
                {toBengaliNumber(leaveCount)} <span className="text-xs font-sans font-medium text-white/80">জন</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-white/15 border border-white/15 flex items-center justify-center shrink-0">
              <Coffee className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="text-[10.5px] text-white/85 mt-2">
            অনুমোদিত ছুটি
          </div>
        </div>

        {/* Total OT */}
        <div className="relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-[#06B6D4] to-[#0D9488] text-white shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-medium text-white/85">
                {isSelectedFri ? 'শুক্রবার ওটি ঘণ্টা' : 'মোট ওটি ঘণ্টা'}
              </div>
              <div className="text-xl font-extrabold font-mono text-white mt-1 tabular-nums tracking-tight">
                {toBengaliNumber(totalOtHoursToday)} <span className="text-xs font-sans font-medium text-white/80">ঘণ্টা</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-white/15 border border-white/15 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="text-[10.5px] text-white/85 mt-2 tabular-nums">
            {isSelectedFri ? `ওটি ডিউটি: ${toBengaliNumber(fridayOtWorkersCount)} জন` : 'আজকের অতিরিক্ত কাজ'}
          </div>
        </div>
      </div>

      {/* ================= SUB VIEW 1: DAILY ROSTER ENTRY ================= */}
      {subView === 'roster' && (
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 space-y-4">
          {/* Quick Actions & Filters Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-slate-100">
            {/* Search & Dept */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="নাম বা আইডি খুঁজুন..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-teal-600 outline-none"
                />
              </div>

              {departments.length > 0 && (
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-teal-600 outline-none cursor-pointer"
                >
                  <option value="all">সকল সেকশন ({activeEmployees.length})</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Quick Bulk Action Button */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleOpenSingleModal()}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#1D63DC] to-[#2563EB] hover:from-blue-600 hover:to-blue-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
              >
                <Clock className="w-3.5 h-3.5 text-cyan-200" />
                <span>+ একক কর্মী {isSelectedFri ? 'ওটি এন্ট্রি' : 'হাজিরা ও ওটি এন্ট্রি'}</span>
              </button>

              {!isSelectedFri ? (
                <button
                  type="button"
                  onClick={handleBulkMarkAllPresent}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>এক ক্লিকে সবাইকে উপস্থিত করুন ({shiftSettings.standardInTime})</span>
                </button>
              ) : (
                <div className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 font-semibold text-xs flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span>শুক্রবার সাপ্তাহিক বন্ধ (হাজিরা নেই, শুধু ওটি প্রযোজ্য)</span>
                </div>
              )}

              {recordedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDeleteDayModal(true)}
                  className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition"
                  title="এই দিনের সম্পূর্ণ হাজিরা শিট/রিপোর্ট এক ক্লিকে মুছে ফেলুন"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>আজকের রিপোর্ট মুছুন ({toBengaliNumber(recordedCount)})</span>
                </button>
              )}
            </div>
          </div>

          {/* Friday Special Notice Banner */}
          {isSelectedFri && (
            <div className="p-3 bg-gradient-to-r from-indigo-950 via-indigo-900 to-purple-950 text-white rounded-xl flex items-center justify-between gap-3 shadow-xs border border-indigo-700/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <div className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                    <span>🕌 শুক্রবার — সাপ্তাহিক ছুটি ও কারখানা বন্ধ</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold">
                      শুধু ওভারটাইম (OT) মোড
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-200 mt-0.5">
                    আজ কারখানা বন্ধ থাকায় সম্পূর্ণ কাজ <b>ওভারটাইম (OT) ঘণ্টা</b> হিসেবে গণনা হবে। <b>শুক্রবার নিয়ম:</b> দুপুর <b>১:০০টা থেকে ২:০০টা পর্যন্ত (১ ঘণ্টা)</b> নামাজের ও খাবারের বিরতি স্বয়ংক্রিয়ভাবে ওটি থেকে বাদ দিয়ে ধরা হচ্ছে।
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg font-bold border transition cursor-pointer whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              সব কর্মী ({activeEmployees.length})
            </button>
            {!isSelectedFri ? (
              <>
                <button
                  type="button"
                  onClick={() => setStatusFilter('present')}
                  className={`px-3 py-1 rounded-lg font-bold border transition cursor-pointer whitespace-nowrap ${
                    statusFilter === 'present'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  উপস্থিত ({presentCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('late')}
                  className={`px-3 py-1 rounded-lg font-bold border transition cursor-pointer whitespace-nowrap ${
                    statusFilter === 'late'
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  লেট ({lateCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('absent')}
                  className={`px-3 py-1 rounded-lg font-bold border transition cursor-pointer whitespace-nowrap ${
                    statusFilter === 'absent'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  অনুপস্থিত ({absentCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('leave')}
                  className={`px-3 py-1 rounded-lg font-bold border transition cursor-pointer whitespace-nowrap ${
                    statusFilter === 'leave'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  ছুটি ({leaveCount})
                </button>
              </>
            ) : (
              <div className="px-3 py-1 rounded-lg font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs">
                ওটি ডিউটি ({fridayOtWorkersCount} জন) • ছুটি/বন্ধ ({Math.max(0, activeEmployees.length - fridayOtWorkersCount)} জন)
              </div>
            )}
            <button
              type="button"
              onClick={() => setStatusFilter('unmarked')}
              className={`px-3 py-1 rounded-lg font-bold border transition cursor-pointer whitespace-nowrap ${
                statusFilter === 'unmarked'
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
            >
              বাকি রয়েছে ({Math.max(0, activeEmployees.length - recordedCount)})
            </button>
          </div>

          {/* Workers Roster List */}
          {isSelectedFri && (
            <div className="p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-indigo-600 text-white font-black text-[10px]">শুক্রবার ওটি</span>
                <span>
                  <b>শুক্রবার ওভারটাইম নিয়ম:</b> কারখানা সাপ্তাহিক বন্ধ, পুরো কাজ ওটি হিসেবে গণ্য হবে। তবে দুপুর <b>১:০০টা হতে ২:০০টা পর্যন্ত (১ ঘণ্টা)</b> নামাজের ও খাবারের বিরতি স্বয়ংক্রিয়ভাবে ওটি থেকে বাদ দেওয়া হচ্ছে।
                </span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-200 text-indigo-900 shrink-0">
                ১:০০ PM - ২:০০ PM বিরতি বাদ
              </span>
            </div>
          )}
          <div className="space-y-3">
            {filteredEmployees.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                কোনো কর্মচারী পাওয়া যায়নি
              </div>
            ) : (
              filteredEmployees.map((emp) => {
                const draft = dailyDrafts[emp.id] || {
                  status: isSelectedFri ? 'holiday' : 'present',
                  inTime: '',
                  outTime: '',
                  note: '',
                  saved: false,
                };

                const metrics = calculateAttendanceMetrics(
                  draft.inTime,
                  draft.outTime,
                  shiftSettings,
                  selectedDate
                );

                return (
                  <div
                    key={emp.id}
                    className={`p-3.5 rounded-xl border transition-all duration-150 ${
                      isSelectedFri
                        ? (draft.otHours || 0) > 0 || (draft.inTime && draft.outTime)
                          ? 'bg-indigo-50/40 border-indigo-300'
                          : draft.saved
                          ? 'bg-white border-slate-200'
                          : 'bg-slate-50/50 border-slate-200'
                        : draft.status === 'absent'
                        ? 'bg-rose-50/30 border-rose-200'
                        : draft.status === 'late' || metrics.isLate
                        ? 'bg-amber-50/30 border-amber-200'
                        : draft.saved
                        ? 'bg-white border-slate-200 hover:border-blue-300'
                        : 'bg-blue-50/20 border-blue-200'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      {/* Left: Worker Info */}
                      <div className="flex items-center gap-3 min-w-[220px]">
                        {emp.photoUrl ? (
                          <img
                            src={emp.photoUrl}
                            alt={emp.name}
                            className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-base shrink-0">
                            {emp.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 text-sm">
                              {emp.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                              {emp.workerId}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {emp.designation} • {emp.department || 'সাধারণ'}
                          </p>

                          {/* Quick Link to Worker Profile */}
                          {onViewEmployeeProfile && (
                            <button
                              type="button"
                              onClick={() => onViewEmployeeProfile(emp.id)}
                              className="text-[10px] text-blue-600 hover:underline font-bold mt-0.5 inline-block"
                            >
                              হাজিরা প্রোফাইল দেখুন &rarr;
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Middle: Status Buttons */}
                      {isSelectedFri ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              const defaultIn = draft.inTime || shiftSettings.standardInTime || '08:00';
                              const defaultOut = draft.outTime || shiftSettings.standardOutTime || '17:00';
                              const metrics = calculateAttendanceMetrics(defaultIn, defaultOut, shiftSettings, selectedDate);
                              const otToSet = (draft.otHours && draft.otHours > 0) ? draft.otHours : (metrics.otHours > 0 ? metrics.otHours : 8);
                              setDailyDrafts((prev) => ({
                                ...prev,
                                [emp.id]: {
                                  ...(prev[emp.id] || {}),
                                  status: 'holiday',
                                  inTime: defaultIn,
                                  outTime: defaultOut,
                                  otHours: otToSet,
                                  saved: false,
                                },
                              }));
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                              (draft.otHours || 0) > 0 || (draft.inTime && draft.outTime)
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                            }`}
                          >
                            🕌 শুক্রবার ওটি ডিউটি
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateDraft(emp.id, 'status', 'holiday');
                              handleUpdateDraft(emp.id, 'otHours', 0);
                              handleUpdateDraft(emp.id, 'inTime', '');
                              handleUpdateDraft(emp.id, 'outTime', '');
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                              (draft.otHours || 0) === 0 && !draft.inTime && !draft.outTime
                                ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            🏖️ শুক্রবার বন্ধ (ছুটি)
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateDraft(emp.id, 'status', 'present');
                              if (!draft.inTime) {
                                handleUpdateDraft(emp.id, 'inTime', shiftSettings.standardInTime);
                              }
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                              draft.status === 'present'
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            উপস্থিত
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateDraft(emp.id, 'status', 'late')}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                              draft.status === 'late'
                                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                            }`}
                          >
                            লেট / বিলম্ব
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateDraft(emp.id, 'status', 'absent');
                              handleUpdateDraft(emp.id, 'inTime', '');
                              handleUpdateDraft(emp.id, 'outTime', '');
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                              draft.status === 'absent'
                                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                            }`}
                          >
                            অনুপস্থিত
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateDraft(emp.id, 'status', 'half_day')}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                              draft.status === 'half_day'
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                            }`}
                          >
                            অর্ধ-দিবস
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateDraft(emp.id, 'status', 'leave');
                              handleUpdateDraft(emp.id, 'inTime', '');
                              handleUpdateDraft(emp.id, 'outTime', '');
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                              draft.status === 'leave'
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                            }`}
                          >
                            ছুটি
                          </button>
                        </div>
                      )}

                      {/* Right: In-Time & Out-Time Inputs + Metric tags */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {draft.status !== 'absent' && draft.status !== 'leave' ? (
                          <>
                            {/* In-Time */}
                            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-1">
                              <span className="text-[10px] font-bold text-slate-500 px-1">IN:</span>
                              <input
                                type="time"
                                value={draft.inTime}
                                onFocus={(e) => {
                                  if (!e.currentTarget.value) {
                                    const def = getDefaultAmInTime();
                                    e.currentTarget.value = def;
                                    handleUpdateDraft(emp.id, 'inTime', def);
                                  }
                                }}
                                onChange={(e) => handleUpdateDraft(emp.id, 'inTime', e.target.value)}
                                className="bg-transparent text-xs font-bold text-slate-800 outline-none w-20 cursor-pointer"
                              />
                              <button
                                type="button"
                                onClick={() => handleQuickTime(emp.id, 'inTime')}
                                title="বর্তমান সময় সেট করুন"
                                className="px-1.5 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-700 text-[10px] font-bold transition cursor-pointer"
                              >
                                Now
                              </button>
                            </div>

                            {/* Out-Time */}
                            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-1">
                              <span className="text-[10px] font-bold text-slate-500 px-1">OUT:</span>
                              <input
                                type="time"
                                value={draft.outTime}
                                onFocus={(e) => {
                                  if (!e.currentTarget.value) {
                                    const def = getDefaultPmOutTime();
                                    e.currentTarget.value = def;
                                    handleUpdateDraft(emp.id, 'outTime', def);
                                  }
                                }}
                                onChange={(e) => handleUpdateDraft(emp.id, 'outTime', e.target.value)}
                                className="bg-transparent text-xs font-bold text-slate-800 outline-none w-20 cursor-pointer"
                              />
                              <button
                                type="button"
                                onClick={() => handleQuickTime(emp.id, 'outTime')}
                                title="বর্তমান সময় সেট করুন"
                                className="px-1.5 py-0.5 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[10px] font-bold transition cursor-pointer"
                              >
                                Now
                              </button>
                            </div>

                            {/* Overtime (OT) Hours Input & Quick Increment Buttons */}
                            <div className="flex items-center bg-indigo-50/70 border border-indigo-200 rounded-lg p-1 gap-1">
                              <span className="text-[10px] font-extrabold text-indigo-900 px-1 flex items-center gap-0.5">
                                <Sparkles className="w-3 h-3 text-indigo-600" />
                                <span>OT:</span>
                              </span>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="16"
                                placeholder="0"
                                value={draft.otHours ?? 0}
                                onChange={(e) =>
                                  handleUpdateDraft(
                                    emp.id,
                                    'otHours',
                                    Math.max(0, parseFloat(e.target.value) || 0)
                                  )
                                }
                                className="w-14 bg-white border border-indigo-200 rounded px-1.5 py-0.5 text-xs font-black text-indigo-900 text-center outline-none focus:ring-1 focus:ring-indigo-500"
                                title="ওভারটাইম ঘণ্টা (সরাসরি লিখুন বা দ্রুত বাটন চাপুন)"
                              />
                              <span className="text-[10px] font-bold text-indigo-600">ঘণ্টা</span>
                              {isSelectedFri && metrics.fridayBreakDeductedMinutes && metrics.fridayBreakDeductedMinutes > 0 ? (
                                <span
                                  className="text-[9px] font-bold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-300 shrink-0"
                                  title="দুপুর ১:০০টা হতে ২:০০টা পর্যন্ত ১ ঘণ্টা নামাজের ও খাবারের বিরতি বাদ দিয়ে হিসাব করা হয়েছে"
                                >
                                  -১ঘ. বিরতি বাদ
                                </span>
                              ) : null}

                              {/* Quick OT Buttons */}
                              <div className="flex items-center gap-0.5 pl-0.5 border-l border-indigo-200">
                                <button
                                  type="button"
                                  onClick={() => handleAddOtHours(emp.id, 1)}
                                  title="+১ ঘণ্টা ওটি যোগ করুন"
                                  className="px-1.5 py-0.5 rounded bg-white hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold border border-indigo-200 cursor-pointer transition active:scale-95"
                                >
                                  +1h
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddOtHours(emp.id, 2)}
                                  title="+২ ঘণ্টা ওটি যোগ করুন"
                                  className="px-1.5 py-0.5 rounded bg-white hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold border border-indigo-200 cursor-pointer transition active:scale-95"
                                >
                                  +2h
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddOtHours(emp.id, 3)}
                                  title="+৩ ঘণ্টা ওটি যোগ করুন"
                                  className="px-1.5 py-0.5 rounded bg-white hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold border border-indigo-200 cursor-pointer transition active:scale-95"
                                >
                                  +3h
                                </button>
                                {(draft.otHours || 0) > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleSetOtHours(emp.id, 0)}
                                    title="ওটি শূন্য করুন"
                                    className="px-1 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-bold border border-rose-200 cursor-pointer transition"
                                  >
                                    ০h
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Dynamic Badges: Late & OT */}
                            {!isSelectedFri && metrics.isLate && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-300">
                                ⚠️ {metrics.lateMinutes} মি. লেট
                              </span>
                            )}

                            {(draft.otHours || 0) > 0 && (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                isSelectedFri
                                  ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                                  : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              }`}>
                                ⚡ {draft.otHours}h {isSelectedFri ? 'শুক্র ওটি (হাজিরা নেই)' : 'OT'}
                              </span>
                            )}
                          </>
                        ) : (
                          <div className="text-xs text-slate-400 italic px-2">
                            {draft.status === 'absent' ? 'আজ অনুপস্থিত' : 'অনুমোদিত ছুটিতে রয়েছেন'}
                          </div>
                        )}

                        {/* Note Input */}
                        <input
                          type="text"
                          placeholder="মন্তব্য (ঐচ্ছিক)"
                          value={draft.note}
                          onFocus={() => setIsWritingComment(true)}
                          onBlur={() => setIsWritingComment(false)}
                          onChange={(e) => handleUpdateDraft(emp.id, 'note', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveSingle(emp);
                            }
                          }}
                          autoComplete="off"
                          className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-blue-400 outline-none w-28 lg:w-32"
                        />

                        {/* Save Button */}
                        <button
                          type="button"
                          onClick={() => handleSaveSingle(emp)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer active:scale-95 shadow-xs ${
                            draft.saved
                              ? 'bg-slate-100 text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          {draft.saved ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>সংরক্ষিত</span>
                            </>
                          ) : (
                            <>
                              <Save className="w-3.5 h-3.5" />
                              <span>সেভ</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ================= SUB VIEW 2: RECORDS & MONTHLY REPORT ================= */}
      {subView === 'records' && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                হাজিরা রেকর্ড ও লগ হিস্ট্রি
              </h3>
              <p className="text-xs text-slate-500">
                সকল শ্রমিকের দৈনিক ইন/আউট টাইম, লেট ও ওটি হিস্ট্রি ফিল্টার করুন
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleOpenSingleModal()}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                <span>+ নতুন হাজিরা ও ওটি দিন</span>
              </button>

              {attendanceRecords.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDeleteAllModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95"
                  title="সকল মাসের সমস্ত হাজিরা রেকর্ড এক ক্লিকে সম্পূর্ণ মুছে ফেলুন"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-200" />
                  <span>সকল হাজিরা মুছুন ({toBengaliNumber(attendanceRecords.length)})</span>
                </button>
              )}

              {filteredHistoryRecords.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDeleteReportModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95"
                  title="ফিল্টারকৃত এই হাজিরা রিপোর্ট এক ক্লিকে মুছে ফেলুন"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-100" />
                  <span>ফিল্টারকৃত রিপোর্ট মুছুন ({toBengaliNumber(filteredHistoryRecords.length)})</span>
                </button>
              )}

              <div className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                মোট রেকর্ড: <span className="text-blue-600">{toBengaliNumber(filteredHistoryRecords.length)} টি</span>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            {/* Employee Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">কর্মী নির্বাচন:</label>
              <select
                value={historyEmpId}
                onChange={(e) => setHistoryEmpId(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
              >
                <option value="all">সকল কর্মচারী</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.workerId})
                  </option>
                ))}
              </select>
            </div>

            {/* Month Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">মাস:</label>
              <select
                value={historyMonth}
                onChange={(e) => setHistoryMonth(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
              >
                <option value="all">সকল মাস</option>
                <option value="01">জানুয়ারি (০১)</option>
                <option value="02">ফেব্রুয়ারি (০২)</option>
                <option value="03">মার্চ (০৩)</option>
                <option value="04">এপ্রিল (০৪)</option>
                <option value="05">মে (০৫)</option>
                <option value="06">জুন (০৬)</option>
                <option value="07">জুলাই (০৭)</option>
                <option value="08">আগস্ট (০৮)</option>
                <option value="09">সেপ্টেম্বর (০৯)</option>
                <option value="10">অক্টোবর (১০)</option>
                <option value="11">নভেম্বর (১১)</option>
                <option value="12">ডিসেম্বর (১২)</option>
              </select>
            </div>

            {/* Year Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">বছর:</label>
              <select
                value={historyYear}
                onChange={(e) => setHistoryYear(Number(e.target.value))}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
              >
                <option value={2026}>২০২৬</option>
                <option value={2025}>২০২৫</option>
                <option value={2024}>২০২৪</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">স্ট্যাটাস:</label>
              <select
                value={historyStatus}
                onChange={(e) => setHistoryStatus(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
              >
                <option value="all">সকল স্ট্যাটাস</option>
                <option value="present">উপস্থিত (Present)</option>
                <option value="late">লেট (Late)</option>
                <option value="absent">অনুপস্থিত (Absent)</option>
                <option value="half_day">অর্ধ-দিবস (Half Day)</option>
                <option value="leave">ছুটি (Leave)</option>
                <option value="friday_ot">শুক্রবার ওটি ডিউটি (Friday OT)</option>
                <option value="holiday">সাপ্তাহিক বন্ধ / ছুটি (Holiday)</option>
              </select>
            </div>
          </div>

          {/* Records Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">তারিখ</th>
                  <th className="p-3">কর্মী ও আইডি</th>
                  <th className="p-3">স্ট্যাটাস</th>
                  <th className="p-3">ইন টাইম</th>
                  <th className="p-3">আউট টাইম</th>
                  <th className="p-3">বিলম্ব / লেট</th>
                  <th className="p-3">ওটি ঘণ্টা</th>
                  <th className="p-3">মন্তব্য</th>
                  <th className="p-3 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistoryRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      কোনো রেকর্ড পাওয়া যায়নি
                    </td>
                  </tr>
                ) : (
                  filteredHistoryRecords.slice(0, 100).map((r) => {
                    const isRecordFri = isFriday(r.date);
                    const badge = getAttendanceStatusBadge(r.status, r.date, r.otHours);
                    return (
                      <tr key={r.id} className={`hover:bg-slate-50/80 transition ${isRecordFri ? 'bg-indigo-50/20' : ''}`}>
                        <td className="p-3 font-bold text-slate-800 whitespace-nowrap">
                          {formatDateBn(r.date)} {isRecordFri && <span className="text-[10px] text-indigo-700 font-bold ml-1">(শুক্রবার)</span>}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{r.employeeName}</div>
                          <div className="text-[10px] text-slate-500">{r.workerId}</div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.badgeClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                            {badge.label}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                          {formatTime12h(r.inTime)}
                        </td>
                        <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                          {formatTime12h(r.outTime)}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {!isRecordFri && (r.isLate || r.lateMinutes) ? (
                            <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              {r.lateMinutes || 0} মিনিট
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {r.otHours && r.otHours > 0 ? (
                            <span className={`font-bold px-2 py-0.5 rounded-md border ${
                              isRecordFri
                                ? 'text-indigo-800 bg-indigo-50 border-indigo-200'
                                : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            }`}>
                              {r.otHours} ঘণ্টা {isRecordFri ? '(শুক্র ওটি)' : ''}
                            </span>
                          ) : (
                            <span className="text-slate-400">০</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 max-w-[150px] truncate">
                          {r.note || (isRecordFri && r.otHours ? 'শুক্রবার ওটি ডিউটি' : '—')}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setSingleEmpId(r.employeeId);
                              setSingleDate(r.date);
                              setSingleStatus(r.status);
                              setSingleInTime(r.inTime || shiftSettings.standardInTime);
                              setSingleOutTime(r.outTime || shiftSettings.standardOutTime);
                              setSingleOtHours(typeof r.otHours === 'number' ? r.otHours : 0);
                              setSingleNote(r.note || '');
                              setShowSingleModal(true);
                            }}
                            title="হাজিরা ও ওটি এডিট করুন"
                            className="p-1 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition cursor-pointer mr-1 inline-flex items-center"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteHistoryRecord(r.id)}
                            title="রেকর্ড মুছে ফেলুন"
                            className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer inline-flex items-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= HIDDEN PRINTABLE AREA FOR DAILY ATTENDANCE SHEET ================= */}
      <div className="hidden">
        <div ref={printAreaRef} className="p-6 bg-white text-slate-900 font-sans max-w-xl mx-auto">
          <div className="text-center pb-4 border-b border-slate-300">
            <h2 className="text-xl font-black">টেক্স ওয়ার অ্যাপারেলস</h2>
            <p className="text-xs text-slate-600">
              {isSelectedFri ? 'শুক্রবার বিশেষ ওভারটাইম (OT) ডিউটি শিট' : 'দৈনিক শ্রমিক হাজিরা ও ওভারটাইম শিট'}
            </p>
            <p className="text-xs font-bold mt-1">
              তারিখ: {formatDateBn(selectedDate)} {isSelectedFri ? '(শুক্রবার - সাপ্তাহিক বন্ধ)' : `| শিফট: ${formatTime12h(shiftSettings.standardInTime)} - ${formatTime12h(shiftSettings.standardOutTime)}`}
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2 my-3 text-center text-xs">
            <div className="p-2 border border-slate-200 rounded">
              <div className="text-[10px] text-slate-500">মোট কর্মী</div>
              <div className="font-bold">{activeEmployees.length}</div>
            </div>
            <div className="p-2 border border-slate-200 rounded">
              <div className="text-[10px] text-slate-500">{isSelectedFri ? 'হাজিরা' : 'উপস্থিত'}</div>
              <div className="font-bold text-emerald-700">
                {isSelectedFri ? '০ (সাপ্তাহিক বন্ধ)' : presentCount}
              </div>
            </div>
            <div className="p-2 border border-slate-200 rounded">
              <div className="text-[10px] text-slate-500">{isSelectedFri ? 'ওটি কর্মী' : 'অনুপস্থিত'}</div>
              <div className="font-bold text-rose-700">
                {isSelectedFri ? `${fridayOtWorkersCount} জন` : absentCount}
              </div>
            </div>
            <div className="p-2 border border-slate-200 rounded">
              <div className="text-[10px] text-slate-500">মোট ওটি</div>
              <div className="font-bold text-indigo-700">{totalOtHoursToday} ঘণ্টা</div>
            </div>
          </div>

          <table className="w-full text-[11px] border border-slate-300 mt-2">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-left">
                <th className="p-1.5 border-r border-slate-300">আইডি</th>
                <th className="p-1.5 border-r border-slate-300">নাম</th>
                <th className="p-1.5 border-r border-slate-300">স্ট্যাটাস</th>
                <th className="p-1.5 border-r border-slate-300">ইন টাইম</th>
                <th className="p-1.5 border-r border-slate-300">আউট টাইম</th>
                <th className="p-1.5">ওটি</th>
              </tr>
            </thead>
            <tbody>
              {activeEmployees.map((emp) => {
                const rec = recordsForSelectedDate.find((r) => r.employeeId === emp.id || r.workerId === emp.workerId);
                const rowBadge = getAttendanceStatusBadge(rec?.status || 'holiday', selectedDate, rec?.otHours);
                return (
                  <tr key={emp.id} className="border-b border-slate-200">
                    <td className="p-1.5 border-r border-slate-200 font-bold">{emp.workerId}</td>
                    <td className="p-1.5 border-r border-slate-200">{emp.name}</td>
                    <td className="p-1.5 border-r border-slate-200 font-semibold">
                      {rec ? rowBadge.label : (isSelectedFri ? 'শুক্রবার (বন্ধ)' : '—')}
                    </td>
                    <td className="p-1.5 border-r border-slate-200">{formatTime12h(rec?.inTime)}</td>
                    <td className="p-1.5 border-r border-slate-200">{formatTime12h(rec?.outTime)}</td>
                    <td className="p-1.5 font-bold">{rec?.otHours ? `${rec.otHours}h` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-8 pt-4 flex justify-between text-xs border-t border-slate-300">
            <div>এইচআর / টাইমকিপার স্বাক্ষর: _________________</div>
            <div>কর্তৃপক্ষের স্বাক্ষর: _________________</div>
          </div>
        </div>
      </div>

      {/* ================= SHIFT CONFIGURATION MODAL ================= */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-slate-900 text-sm">শিফট ও ইন-আউট টাইম সেটিংস</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShiftModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  স্ট্যান্ডার্ড শিফট ইন টাইম (In Time):
                </label>
                <input
                  type="time"
                  value={tempShift.standardInTime}
                  onFocus={(e) => {
                    if (!e.currentTarget.value) {
                      const def = getDefaultAmInTime();
                      e.currentTarget.value = def;
                      setTempShift((prev) => ({ ...prev, standardInTime: def }));
                    }
                  }}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setTempShift((prev) => ({
                      ...prev,
                      standardInTime: !prev.standardInTime && raw ? coerceTimePeriod(raw, 'AM') : raw,
                    }));
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  গার্মেন্টস বা কারখানার সাধারণ প্রবেশের সময় (যেমন: 08:00 AM)
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  স্ট্যান্ডার্ড শিফট আউট টাইম (Out Time):
                </label>
                <input
                  type="time"
                  value={tempShift.standardOutTime}
                  onFocus={(e) => {
                    if (!e.currentTarget.value) {
                      const def = getDefaultPmOutTime();
                      e.currentTarget.value = def;
                      setTempShift((prev) => ({ ...prev, standardOutTime: def }));
                    }
                  }}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setTempShift((prev) => ({
                      ...prev,
                      standardOutTime: !prev.standardOutTime && raw ? coerceTimePeriod(raw, 'PM') : raw,
                    }));
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  সাধারণ ছুটি হওয়ার সময় (যেমন: 17:00 / 05:00 PM)। এই সময়ের পর কাজ করলে স্বয়ংক্রিয়ভাবে
                  ওভারটাইম হিসেব হবে।
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  বিলম্ব ছাড় / গ্রেস পিরিয়ড (মিনিট):
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={tempShift.graceMinutes}
                  onChange={(e) =>
                    setTempShift((prev) => ({
                      ...prev,
                      graceMinutes: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  কত মিনিট পর্যন্ত দেরি হলে লেট কাউন্ট হবে না (যেমন: ১৫ মিনিট)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveShiftSettings}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                সেটিংস সংরক্ষণ করুন
              </button>
              <button
                type="button"
                onClick={() => setShowShiftModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= SINGLE WORKER ATTENDANCE & OVERTIME ENTRY MODAL ================= */}
      {showSingleModal && (() => {
        const targetEmp = employees.find((e) => e.id === singleEmpId) || activeEmployees[0];
        const existingForModalDate = attendanceRecords.find(
          (r) => r.employeeId === (targetEmp?.id) && r.date === singleDate
        );

        const filteredList = employees.filter((e) => {
          if (!singleSearch.trim()) return true;
          const q = singleSearch.toLowerCase();
          return (
            e.name.toLowerCase().includes(q) ||
            e.workerId.toLowerCase().includes(q) ||
            (e.department && e.department.toLowerCase().includes(q))
          );
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-2xl border border-slate-200 space-y-3.5 my-auto max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-sm">একক কর্মী হাজিরা ও ওভারটাইম এন্ট্রি</h3>
                    <p className="text-[10px] text-slate-500">শ্রমিকের ইন/আউট টাইম ও কত ঘণ্টা ওভারটাইম তা সরাসরি সেট করুন</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSingleModal(false)}
                  className="text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer"
                >
                  &times;
                </button>
              </div>

              {/* 1. Worker Selection with Quick Search */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  ১. কর্মী নির্বাচন করুন *
                </label>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="শ্রমিকের নাম বা আইডি খুঁজুন..."
                    value={singleSearch}
                    onChange={(e) => setSingleSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white outline-none"
                  />
                </div>

                <select
                  value={targetEmp?.id || ''}
                  onChange={(e) => handleSelectSingleEmployee(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white cursor-pointer"
                >
                  {filteredList.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} — {emp.workerId} ({emp.designation}) {emp.status === 'resigned' ? '[রিজাইন]' : ''}
                    </option>
                  ))}
                </select>

                {/* Selected Worker Info Card */}
                {targetEmp && (
                  <div className="p-2.5 bg-gradient-to-r from-blue-50/70 to-indigo-50/50 rounded-xl border border-blue-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      {targetEmp.photoUrl ? (
                        <img
                          src={targetEmp.photoUrl}
                          alt={targetEmp.name}
                          className="w-9 h-9 rounded-full object-cover border border-blue-200"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
                          {targetEmp.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-900">{targetEmp.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {targetEmp.workerId} • {targetEmp.designation} • {targetEmp.department || 'সাধারণ'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500">ওটি রেট:</div>
                      <div className="font-bold text-indigo-700">{targetEmp.otRate || 0} ৳/ঘণ্টা</div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Date Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  ২. হাজিরার তারিখ *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={singleDate}
                    onChange={(e) => {
                      const newD = e.target.value;
                      setSingleDate(newD);
                      const isNewDFri = isFriday(newD);
                      if (targetEmp) {
                        const rec = attendanceRecords.find(
                          (r) => (r.employeeId === targetEmp.id || r.workerId === targetEmp.workerId) && r.date === newD
                        );
                        if (rec) {
                          setSingleStatus(isNewDFri ? 'holiday' : rec.status);
                          setSingleInTime(rec.inTime || (isNewDFri ? '' : shiftSettings.standardInTime));
                          setSingleOutTime(rec.outTime || (isNewDFri ? '' : shiftSettings.standardOutTime));
                          setSingleOtHours(typeof rec.otHours === 'number' ? rec.otHours : 0);
                          setSingleNote(rec.note || '');
                        } else {
                          setSingleStatus(isNewDFri ? 'holiday' : 'present');
                          setSingleInTime(isNewDFri ? '' : shiftSettings.standardInTime);
                          setSingleOutTime(isNewDFri ? '' : shiftSettings.standardOutTime);
                          setSingleOtHours(0);
                          setSingleNote('');
                        }
                      }
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const today = getTodayDateString();
                      setSingleDate(today);
                      const isTodayFri = isFriday(today);
                      if (targetEmp) {
                        const rec = attendanceRecords.find(
                          (r) => (r.employeeId === targetEmp.id || r.workerId === targetEmp.workerId) && r.date === today
                        );
                        if (rec) {
                          setSingleStatus(isTodayFri ? 'holiday' : rec.status);
                          setSingleInTime(rec.inTime || (isTodayFri ? '' : shiftSettings.standardInTime));
                          setSingleOutTime(rec.outTime || (isTodayFri ? '' : shiftSettings.standardOutTime));
                          setSingleOtHours(typeof rec.otHours === 'number' ? rec.otHours : 0);
                          setSingleNote(rec.note || '');
                        } else {
                          setSingleStatus(isTodayFri ? 'holiday' : 'present');
                          setSingleInTime(isTodayFri ? '' : shiftSettings.standardInTime);
                          setSingleOutTime(isTodayFri ? '' : shiftSettings.standardOutTime);
                          setSingleOtHours(0);
                          setSingleNote('');
                        }
                      }
                    }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer"
                  >
                    আজকে
                  </button>
                </div>

                {existingForModalDate && (
                  <div className="mt-2 p-2.5 bg-amber-50 rounded-xl border border-amber-300 text-[11px] text-amber-900 space-y-0.5">
                    <div className="font-bold flex items-center gap-1 text-amber-950">
                      <span>⚠️ এই তারিখে ইতিমধ্যে ১টি হাজিরা রেকর্ড সংরক্ষিত আছে:</span>
                      <b className="underline">
                        {getAttendanceStatusBadge(existingForModalDate.status, existingForModalDate.date, existingForModalDate.otHours).label}
                      </b>
                      <span>(IN: {existingForModalDate.inTime || '—'}, OUT: {existingForModalDate.outTime || '—'}, OT: {existingForModalDate.otHours || 0}h)</span>
                    </div>
                    <p className="text-[10px] text-amber-800">
                      নীতি অনুযায়ী একই শ্রমিকের একই তারিখে দুইবার হাজিরা এন্ট্রি হবে না। আপনি সংরক্ষণ করলে পূর্বের রেকর্ডটি হালনাগাদ/আপডেট হবে।
                    </p>
                  </div>
                )}
              </div>

              {/* 3. Status Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  ৩. হাজিরা স্ট্যাটাস *
                </label>
                {isFriday(singleDate) ? (
                  <div className="space-y-2">
                    <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div>
                          <b className="text-indigo-950">শুক্রবার সাপ্তাহিক বন্ধ — কারখানা ছুটি</b>
                          <p className="text-[10px] text-indigo-700">
                            ডিউটি টাইম শুধুমাত্র ওভারটাইম (OT) হিসেবে গণ্য হবে, কোনো সাধারণ হাজিরা বা প্রেজেন্ট গণনা হবে না।
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setSingleStatus('holiday');
                          const defaultIn = singleInTime || shiftSettings.standardInTime || '08:00';
                          const defaultOut = singleOutTime || shiftSettings.standardOutTime || '17:00';
                          setSingleInTime(defaultIn);
                          setSingleOutTime(defaultOut);
                          const metrics = calculateAttendanceMetrics(defaultIn, defaultOut, shiftSettings, singleDate);
                          setSingleOtHours(metrics.otHours > 0 ? metrics.otHours : 8);
                        }}
                        className={`py-2 px-3 rounded-xl border text-center transition cursor-pointer ${
                          singleOtHours > 0 || (singleInTime && singleOutTime)
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                        }`}
                      >
                        🕌 শুক্রবার ওটি ডিউটি (শুধু ওটি)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSingleStatus('holiday');
                          setSingleOtHours(0);
                          setSingleInTime('');
                          setSingleOutTime('');
                        }}
                        className={`py-2 px-3 rounded-xl border text-center transition cursor-pointer ${
                          singleOtHours === 0 && !singleInTime && !singleOutTime
                            ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        🏖️ সাপ্তাহিক বন্ধ / ছুটি (০ ওটি)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-xs font-bold">
                    {[
                      { key: 'present', label: 'উপস্থিত', color: 'emerald' },
                      { key: 'late', label: 'লেট / বিলম্ব', color: 'amber' },
                      { key: 'absent', label: 'অনুপস্থিত', color: 'rose' },
                      { key: 'half_day', label: 'অর্ধ-দিবস', color: 'indigo' },
                      { key: 'leave', label: 'ছুটি', color: 'blue' },
                    ].map((st) => (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => setSingleStatus(st.key as AttendanceStatus)}
                        className={`py-2 px-2 rounded-xl border text-center transition cursor-pointer ${
                          singleStatus === st.key
                            ? st.color === 'emerald'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : st.color === 'amber'
                              ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                              : st.color === 'rose'
                              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                              : st.color === 'indigo'
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. In Time, Out Time, and Overtime Input */}
              {(isFriday(singleDate) || (singleStatus !== 'absent' && singleStatus !== 'leave')) && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  {/* Friday Break Notification */}
                  {isFriday(singleDate) && (
                    <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white font-black text-[10px]">
                          শুক্র ওটি বিরতি
                        </span>
                        <span>
                          দুপুর <b>১:০০টা থেকে ২:০০টা পর্যন্ত (১ ঘণ্টা)</b> নামাজের ও খাবারের বিরতি ওটি থেকে বাদ দিয়ে ধরা হচ্ছে।
                        </span>
                      </div>
                      {singleInTime && singleOutTime && (() => {
                        const inM = timeStringToMinutes(singleInTime);
                        const outM = timeStringToMinutes(singleOutTime);
                        if (inM !== null && outM !== null && outM > inM) {
                          const breakM = calculateFridayBreakDeductionMinutes(inM, outM);
                          if (breakM > 0) {
                            return (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                                -১ ঘণ্টা বিরতি বাদ
                              </span>
                            );
                          }
                        }
                        return null;
                      })()}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* IN TIME */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700">ইন টাইম (IN Time):</label>
                        <button
                          type="button"
                          onClick={() => {
                            const now = getCurrentTimeString();
                            setSingleInTime(now);
                            const effOut = singleOutTime || shiftSettings.standardOutTime;
                            const metrics = calculateAttendanceMetrics(now, effOut, shiftSettings, singleDate);
                            setSingleOtHours(metrics.otHours);
                          }}
                          className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                        >
                          এখন (Now)
                        </button>
                      </div>
                      <input
                        type="time"
                        value={singleInTime}
                        onFocus={(e) => {
                          if (!e.currentTarget.value) {
                            const def = getDefaultAmInTime();
                            e.currentTarget.value = def;
                            setSingleInTime(def);
                            const effOut = singleOutTime || shiftSettings.standardOutTime;
                            const metrics = calculateAttendanceMetrics(def, effOut, shiftSettings, singleDate);
                            setSingleOtHours(metrics.otHours);
                          }
                        }}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const val = !singleInTime && raw ? coerceTimePeriod(raw, 'AM') : raw;
                          setSingleInTime(val);
                          const effOut = singleOutTime || shiftSettings.standardOutTime;
                          const metrics = calculateAttendanceMetrics(val, effOut, shiftSettings, singleDate);
                          setSingleOtHours(metrics.otHours);
                        }}
                        className="w-full p-2 bg-white border border-slate-300 rounded-xl font-bold text-xs"
                      />
                    </div>

                    {/* OUT TIME */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700">আউট টাইম (OUT Time):</label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const now = getCurrentTimeString();
                              setSingleOutTime(now);
                              const effIn = singleInTime || shiftSettings.standardInTime;
                              const metrics = calculateAttendanceMetrics(effIn, now, shiftSettings, singleDate);
                              setSingleOtHours(metrics.otHours);
                            }}
                            className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer"
                          >
                            এখন (Now)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSingleOutTime(shiftSettings.standardOutTime);
                              const effIn = singleInTime || shiftSettings.standardInTime;
                              const metrics = calculateAttendanceMetrics(effIn, shiftSettings.standardOutTime, shiftSettings, singleDate);
                              setSingleOtHours(metrics.otHours);
                            }}
                            className="text-[10px] text-slate-500 font-bold hover:underline cursor-pointer"
                          >
                            ছুটি ({shiftSettings.standardOutTime})
                          </button>
                        </div>
                      </div>
                      <input
                        type="time"
                        value={singleOutTime}
                        onFocus={(e) => {
                          if (!e.currentTarget.value) {
                            const def = getDefaultPmOutTime();
                            e.currentTarget.value = def;
                            setSingleOutTime(def);
                            const effIn = singleInTime || shiftSettings.standardInTime;
                            const metrics = calculateAttendanceMetrics(effIn, def, shiftSettings, singleDate);
                            setSingleOtHours(metrics.otHours);
                          }
                        }}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const val = !singleOutTime && raw ? coerceTimePeriod(raw, 'PM') : raw;
                          setSingleOutTime(val);
                          const effIn = singleInTime || shiftSettings.standardInTime;
                          const metrics = calculateAttendanceMetrics(effIn, val, shiftSettings, singleDate);
                          setSingleOtHours(metrics.otHours);
                        }}
                        className="w-full p-2 bg-white border border-slate-300 rounded-xl font-bold text-xs"
                      />
                    </div>
                  </div>

                  {/* OVERTIME INPUT & QUICK BUTTONS */}
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-black text-indigo-950 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>ওভারটাইম ঘণ্টা (Overtime Hours):</span>
                      </label>
                      <span className="text-[10px] text-indigo-600 font-semibold">
                        (সরাসরি লিখুন বা নিচের বাটন ক্লিক করুন)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-white border border-indigo-300 rounded-xl px-2.5 py-1.5 shadow-2xs">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="16"
                          value={singleOtHours}
                          onChange={(e) => setSingleOtHours(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-20 text-sm font-black text-indigo-900 outline-none"
                        />
                        <span className="text-xs font-bold text-indigo-600">ঘণ্টা</span>
                      </div>

                      {/* Quick OT Increment Buttons */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setSingleOtHours((prev) => Math.max(0, Math.round((prev + 1) * 10) / 10))}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-xs font-bold transition cursor-pointer active:scale-95"
                        >
                          +১h
                        </button>
                        <button
                          type="button"
                          onClick={() => setSingleOtHours((prev) => Math.max(0, Math.round((prev + 2) * 10) / 10))}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-xs font-bold transition cursor-pointer active:scale-95"
                        >
                          +২h
                        </button>
                        <button
                          type="button"
                          onClick={() => setSingleOtHours((prev) => Math.max(0, Math.round((prev + 3) * 10) / 10))}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-xs font-bold transition cursor-pointer active:scale-95"
                        >
                          +৩h
                        </button>
                        <button
                          type="button"
                          onClick={() => setSingleOtHours((prev) => Math.max(0, Math.round((prev + 0.5) * 10) / 10))}
                          className="px-2 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition cursor-pointer active:scale-95"
                        >
                          +০.৫h
                        </button>
                        {singleOtHours > 0 && (
                          <button
                            type="button"
                            onClick={() => setSingleOtHours(0)}
                            className="px-2 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold transition cursor-pointer"
                          >
                            ০ ঘণ্টা
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. Note / Remark */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  মন্তব্য বা নোট (ঐচ্ছিক):
                </label>
                <input
                  type="text"
                  placeholder="যেমন: বিশেষ ডিউটি, ৩ ঘণ্টা অতিরিক্ত কাজ ইত্যাদি"
                  value={singleNote}
                  onFocus={() => setIsWritingComment(true)}
                  onBlur={() => setIsWritingComment(false)}
                  onChange={(e) => setSingleNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                  autoComplete="off"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSingleModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  disabled={isSavingSingleModal}
                  onClick={handleSaveSingleModal}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingSingleModal ? 'সংরক্ষণ হচ্ছে...' : 'হাজিরা ও ওটি সংরক্ষণ করুন'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================= 1-CLICK DELETE FILTERED ATTENDANCE REPORT MODAL ================= */}
      {showDeleteReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-rose-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center font-bold">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  হাজিরা রিপোর্ট এক ক্লিকে মুছুন
                </h3>
                <p className="text-xs text-slate-500">
                  ফিল্টারকৃত হাজিরা ডেটা পার্মানেন্টলি ডিলিট হবে
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 space-y-2 text-xs">
              <div className="font-bold text-rose-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>আপনি কি নিশ্চিত যে নিচের ফিল্টারকৃত রিপোর্টটি সম্পূর্ণ মুছে ফেলতে চান?</span>
              </div>
              <ul className="text-rose-800 space-y-1 list-disc list-inside text-[11px] font-medium pl-1">
                <li>
                  মোট রেকর্ড: <strong className="font-black text-rose-950">{toBengaliNumber(filteredHistoryRecords.length)} টি</strong>
                </li>
                {historyEmpId !== 'all' && (
                  <li>
                    কর্মী: <strong>{employees.find(e => e.id === historyEmpId)?.name}</strong>
                  </li>
                )}
                {historyMonth !== 'all' && (
                  <li>
                    মাস: <strong>{historyMonth} / {historyYear}</strong>
                  </li>
                )}
                {historyStatus !== 'all' && (
                  <li>
                    স্ট্যাটাস: <strong>{historyStatus}</strong>
                  </li>
                )}
              </ul>
              <p className="text-[10px] text-rose-600 italic">
                * একবার মুছে ফেললে এই রেকর্ডগুলো ক্লাউড ডাটাবেজ ও ডিভাইস থেকে স্থায়ীভাবে রিমুভ হয়ে যাবে।
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteReportModal(false)}
                disabled={isDeletingReport}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={isDeletingReport}
                onClick={handleOneClickDeleteFilteredReport}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingReport ? 'মুছে ফেলা হচ্ছে...' : 'হ্যাঁ, এখনই এক ক্লিকে মুছে ফেলুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 1-CLICK DELETE SELECTED DATE ATTENDANCE REPORT MODAL ================= */}
      {showDeleteDayModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-rose-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center font-bold">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  আজকের হাজিরা শিট এক ক্লিকে মুছুন
                </h3>
                <p className="text-xs text-slate-500">
                  {formatDateBn(selectedDate)}-এর সম্পূর্ণ হাজিরা মুছে যাবে
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 space-y-2 text-xs">
              <div className="font-bold text-rose-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>তারিখ: {formatDateBn(selectedDate)}</span>
              </div>
              <p className="text-rose-800 text-[11px]">
                এই দিনের মোট <strong>{toBengaliNumber(recordsForSelectedDate.length)} টি</strong> সংরক্ষিত হাজিরা ও ওভারটাইম রেকর্ড এক ক্লিকে স্থায়ীভাবে মুছে ফেলা হবে এবং শিটটি খালি হয়ে যাবে।
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteDayModal(false)}
                disabled={isDeletingReport}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={isDeletingReport}
                onClick={handleOneClickDeleteDayReport}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingReport ? 'মুছে ফেলা হচ্ছে...' : 'হ্যাঁ, আজকের হাজিরা মুছে ফেলুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 1-CLICK DELETE ALL ATTENDANCE RECORDS MODAL ================= */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-red-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-red-100 border border-red-300 text-red-700 flex items-center justify-center font-bold">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  সকল হাজিরা ডেটা এক ক্লিকে মুছুন
                </h3>
                <p className="text-xs text-slate-500">
                  সিস্টেমের সমস্ত হাজিরা ও ওভারটাইম লগ সম্পূর্ণ খালি করা হবে
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 space-y-2 text-xs">
              <div className="font-bold text-red-950 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>আপনি কি নিশ্চিত যে সকল হাজিরা রেকর্ড মুছে ফেলতে চান?</span>
              </div>
              <p className="text-red-900 text-[11px] leading-relaxed">
                ডাটাবেজের মোট <strong>{toBengaliNumber(attendanceRecords.length)} টি</strong> হাজিরা এন্ট্রি, ইন/আউট টাইম ও ওভারটাইম লগ এক ক্লিকে স্থায়ীভাবে মুছে ফেলা হবে। কোনো পূর্ববর্তী হাজিরা অবশিষ্ট থাকবে না।
              </p>
              <div className="p-2 bg-white/80 rounded-lg border border-red-200 text-[10px] text-red-700 font-semibold">
                ⚠️ এই অ্যাকশনটি সম্পন্ন হলে সকল রেকর্ড চিরতরে ডিলিট হয়ে যাবে।
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                disabled={isDeletingReport}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={isDeletingReport}
                onClick={handleDeleteAllAttendance}
                className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingReport ? 'মুছে ফেলা হচ্ছে...' : 'হ্যাঁ, সমস্ত হাজিরা মুছে ফেলুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
