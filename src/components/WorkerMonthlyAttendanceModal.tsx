import React, { useState, useEffect, useRef } from 'react';
import { Employee, AttendanceRecord, FactorySettings } from '../types';
import {
  calculateEmployeeAttendanceStats,
  getAttendanceStatusBadge,
  formatTime12h,
  getBengaliDayName,
  isFriday,
  normalizeWorkerId,
} from '../lib/attendanceUtils';
import { formatDateBn, toBengaliNumber, formatMoney } from '../lib/utils';
import { loadFactorySettings, DEFAULT_FACTORY_SETTINGS } from '../lib/firebase';
import { printElement } from '../lib/printer';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  Printer,
  X,
  FileDown,
  Image as ImageIcon,
  Loader2,
  Calendar,
  Building2,
  Phone,
  MapPin,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  User,
  Coffee,
  AlertTriangle,
} from 'lucide-react';

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

interface WorkerMonthlyAttendanceModalProps {
  employee: Employee | null;
  allEmployees?: Employee[];
  records: AttendanceRecord[];
  isOpen: boolean;
  onClose: () => void;
  initialMonth?: string;
  initialYear?: number;
  showToast: (msg: string) => void;
  onSelectEmployee?: (emp: Employee) => void;
}

export const WorkerMonthlyAttendanceModal: React.FC<WorkerMonthlyAttendanceModalProps> = ({
  employee,
  allEmployees = [],
  records,
  isOpen,
  onClose,
  initialMonth,
  initialYear,
  showToast,
  onSelectEmployee,
}) => {
  const printContainerRef = useRef<HTMLDivElement>(null);

  // Month & Year state
  const currentMonthIdx = new Date().getMonth();
  const currentYearNum = new Date().getFullYear();

  const [selectedMonth, setSelectedMonth] = useState<string>(
    initialMonth || BENGALI_MONTHS[currentMonthIdx]
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    initialYear || currentYearNum
  );

  // Factory settings state
  const [factory, setFactory] = useState<FactorySettings>(DEFAULT_FACTORY_SETTINGS);

  // Export loading state
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [safePhotoUrl, setSafePhotoUrl] = useState<string | undefined>(employee?.photoUrl);

  // Pre-load factory settings
  useEffect(() => {
    if (isOpen) {
      loadFactorySettings().then((settings) => {
        if (settings) setFactory(settings);
      });
    }
  }, [isOpen]);

  // Safe image base64 cache
  useEffect(() => {
    let isCancelled = false;
    if (employee?.photoUrl) {
      if (employee.photoUrl.startsWith('data:')) {
        setSafePhotoUrl(employee.photoUrl);
      } else {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || 80;
            canvas.height = img.naturalHeight || 96;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const dataUrl = canvas.toDataURL('image/png');
              if (!isCancelled) setSafePhotoUrl(dataUrl);
              return;
            }
          } catch {
            // fallback
          }
          if (!isCancelled) setSafePhotoUrl(employee.photoUrl);
        };
        img.onerror = () => {
          if (!isCancelled) setSafePhotoUrl(employee.photoUrl);
        };
        img.src = employee.photoUrl;
      }
    } else {
      setSafePhotoUrl(undefined);
    }
    return () => {
      isCancelled = true;
    };
  }, [employee?.photoUrl]);

  if (!isOpen || !employee) return null;

  // Matching helper
  const isRecordForEmployee = (r: AttendanceRecord, emp: Employee) => {
    if (!r || !emp) return false;
    if (r.employeeId && emp.id && r.employeeId === emp.id) return true;
    if (emp.workerId && (r.workerId === emp.workerId || r.employeeId === emp.workerId)) return true;
    if (emp.id && (r.workerId === emp.id || r.employeeId === emp.id)) return true;

    const normEmpWId = normalizeWorkerId(emp.workerId);
    const normRecWId = normalizeWorkerId(r.workerId);
    const normRecEId = normalizeWorkerId(r.employeeId);
    const normEmpId = normalizeWorkerId(emp.id);

    if (normEmpWId) {
      if (normRecWId && (normRecWId === normEmpWId || normRecWId.replace(/^0+/, '') === normEmpWId.replace(/^0+/, ''))) return true;
      if (normRecEId && (normRecEId === normEmpWId || normRecEId.replace(/^0+/, '') === normEmpWId.replace(/^0+/, ''))) return true;
    }
    if (normEmpId) {
      if (normRecEId && normRecEId === normEmpId) return true;
      if (normRecWId && (normRecWId === normEmpId || normRecWId.replace(/^0+/, '') === normEmpId.replace(/^0+/, ''))) return true;
    }

    if (emp.name && r.employeeName && r.employeeName.trim() === emp.name.trim()) return true;
    return false;
  };

  // Month calculations
  const monthIdx = BENGALI_MONTHS.indexOf(selectedMonth);
  const validMonthIdx = monthIdx >= 0 ? monthIdx : currentMonthIdx;
  const daysInMonth = new Date(selectedYear, validMonthIdx + 1, 0).getDate();

  // Compute monthly stats for this employee
  const stats = calculateEmployeeAttendanceStats(
    employee.id,
    records,
    selectedMonth,
    selectedYear,
    employee.workerId,
    employee.name
  );

  // Generate full calendar array for every day of the month (1 to daysInMonth)
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const monthNumberStr = pad(validMonthIdx + 1);

  // Map existing records for fast lookup
  const recordMap = new Map<string, AttendanceRecord>();
  records.forEach((r) => {
    if (isRecordForEmployee(r, employee) && r.date) {
      recordMap.set(r.date, r);
    }
  });

  const calendarDays = [];
  let totalFridaysInMonth = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = pad(d);
    const dateStr = `${selectedYear}-${monthNumberStr}-${dayStr}`;
    const dayName = getBengaliDayName(dateStr);
    const isFri = isFriday(dateStr);
    if (isFri) totalFridaysInMonth++;

    const existingRec = recordMap.get(dateStr);
    calendarDays.push({
      dayNumber: d,
      dateStr,
      dayName,
      isFriday: isFri,
      record: existingRec,
    });
  }

  // Prev / Next employee navigation
  const currentEmpIdx = allEmployees.findIndex((e) => e.id === employee.id);
  const handlePrevEmployee = () => {
    if (allEmployees.length <= 1) return;
    const nextIdx = currentEmpIdx <= 0 ? allEmployees.length - 1 : currentEmpIdx - 1;
    onSelectEmployee?.(allEmployees[nextIdx]);
  };
  const handleNextEmployee = () => {
    if (allEmployees.length <= 1) return;
    const nextIdx = currentEmpIdx >= allEmployees.length - 1 ? 0 : currentEmpIdx + 1;
    onSelectEmployee?.(allEmployees[nextIdx]);
  };

  // 1-Click Print Handler using isolated iframe print helper
  const handlePrint = () => {
    if (!printContainerRef.current) return;
    const safeEmpName = (employee.name || 'Worker').replace(/\s+/g, '_');
    printElement(
      printContainerRef.current,
      `Monthly_Attendance_${employee.workerId || 'Worker'}_${selectedMonth}_${selectedYear}_${safeEmpName}`,
      'sheet'
    );
  };

  // 1-Click PDF Download
  const handleDownloadPDF = async () => {
    if (!printContainerRef.current) return;
    setIsDownloadingPDF(true);
    showToast('মাসিক হাজিরা শিট PDF তৈরি হচ্ছে...');

    try {
      const element = printContainerRef.current;
      const originalWidth = element.style.width;
      const originalMaxWidth = element.style.maxWidth;
      element.style.width = '790px';
      element.style.maxWidth = '790px';

      const canvas = await html2canvas(element, {
        scale: 2.2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 1024,
      });

      element.style.width = originalWidth;
      element.style.maxWidth = originalMaxWidth;

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(
        `Monthly_Attendance_${employee.workerId || 'Worker'}_${selectedMonth}_${selectedYear}.pdf`
      );
      showToast('✓ মাসিক হাজিরা PDF সফলভাবে ডাউনলোড হয়েছে');
    } catch (err) {
      console.error('PDF error:', err);
      showToast('পিডিএফ তৈরিতে সমস্যা হয়েছে');
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  // 1-Click HD Image Download
  const handleDownloadImage = async () => {
    if (!printContainerRef.current) return;
    setIsDownloadingImage(true);
    showToast('HD ছবি তৈরি হচ্ছে...');

    try {
      const element = printContainerRef.current;
      const originalWidth = element.style.width;
      const originalMaxWidth = element.style.maxWidth;
      element.style.width = '790px';
      element.style.maxWidth = '790px';

      const canvas = await html2canvas(element, {
        scale: 2.2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      element.style.width = originalWidth;
      element.style.maxWidth = originalMaxWidth;

      canvas.toBlob((blob) => {
        if (!blob) {
          showToast('ছবি তৈরিতে সমস্যা হয়েছে');
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Monthly_Attendance_${employee.workerId || 'Worker'}_${selectedMonth}_${selectedYear}.png`;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 1500);
        showToast('✓ মাসিক হাজিরা HD ছবি সফলভাবে ডাউনলোড হয়েছে');
      }, 'image/png');
    } catch (err) {
      console.error('Image error:', err);
      showToast('ছবি ডাউনলোডে সমস্যা হয়েছে');
    } finally {
      setIsDownloadingImage(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:bg-white print:p-0 print:m-0 print:static print:overflow-visible">
      {/* Strict Print CSS for full single-page rendering without clipping */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 4mm 6mm 4mm 6mm;
          }
          body, html {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          #workerMonthlyAttendancePrintArea {
            border: none !important;
            box-shadow: none !important;
            padding: 3mm 5mm !important;
            margin: 0 auto !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            page-break-inside: auto !important;
          }
        }
      `}</style>

      <div className="bg-slate-100 rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-300 my-auto flex flex-col max-h-[96vh] overflow-hidden print:max-h-none print:overflow-visible print:border-none print:shadow-none print:bg-white print:m-0 print:p-0 animate-in fade-in zoom-in-95 duration-150">
        
        {/* ================= TOP CONTROL BAR (NO-PRINT) ================= */}
        <div className="bg-slate-900 text-white p-2.5 sm:px-4 flex items-center justify-between gap-2 shrink-0 shadow-sm no-print">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/40">
              <Calendar className="w-5 h-5 shrink-0" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black flex items-center gap-1.5">
                <span>শ্রমিকের মাসিক হাজিরা খাতা (১-ক্লিক প্রিন্ট)</span>
                <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-bold">
                  {selectedMonth} {toBengaliNumber(selectedYear)}
                </span>
              </h2>
              <p className="text-[10px] text-slate-300">
                {employee.name} — কার্ড নং: {employee.workerId} ({employee.designation})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Quick Employee Switcher (Prev/Next) */}
            {allEmployees.length > 1 && (
              <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                <button
                  type="button"
                  onClick={handlePrevEmployee}
                  className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition cursor-pointer"
                  title="পূর্ববর্তী কর্মী"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-bold px-1.5 text-slate-300">
                  {toBengaliNumber(currentEmpIdx + 1)}/{toBengaliNumber(allEmployees.length)}
                </span>
                <button
                  type="button"
                  onClick={handleNextEmployee}
                  className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition cursor-pointer"
                  title="পরবর্তী কর্মী"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* PDF Download */}
            <button
              type="button"
              disabled={isDownloadingPDF}
              onClick={handleDownloadPDF}
              className="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
              title="মাসিক হাজিরা PDF ডাউনলোড করুন"
            >
              {isDownloadingPDF ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-white" />
              )}
              <span className="hidden sm:inline">PDF</span>
            </button>

            {/* Image Download */}
            <button
              type="button"
              disabled={isDownloadingImage}
              onClick={handleDownloadImage}
              className="py-1 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
              title="HD ছবি হিসেবে ডাউনলোড করুন"
            >
              {isDownloadingImage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ImageIcon className="w-3.5 h-3.5 text-white" />
              )}
              <span className="hidden sm:inline">ছবি</span>
            </button>

            {/* MAIN 1-CLICK PRINT BUTTON */}
            <button
              type="button"
              onClick={handlePrint}
              className="py-1 px-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[12px] flex items-center gap-1.5 transition cursor-pointer shadow-md active:scale-95"
              title="১-ক্লিকে সরাসরি প্রিন্ট করুন"
            >
              <Printer className="w-4 h-4" />
              <span>১-ক্লিক প্রিন্ট</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= SECOND CONTROL BAR: MONTH / YEAR / WORKER SELECTOR ================= */}
        <div className="bg-slate-800 border-b border-slate-700 p-2 sm:px-4 flex items-center justify-between gap-2 no-print shrink-0 flex-wrap text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Employee dropdown */}
            {allEmployees.length > 0 && onSelectEmployee && (
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-300 font-bold">কর্মী:</span>
                <select
                  value={employee.id}
                  onChange={(e) => {
                    const found = allEmployees.find((x) => x.id === e.target.value);
                    if (found) onSelectEmployee(found);
                  }}
                  className="bg-slate-900 text-white border border-slate-600 rounded-lg p-1 text-xs font-bold"
                >
                  {allEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.workerId}) — {emp.designation}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Month dropdown */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-300 font-bold">মাস:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-900 text-white border border-slate-600 rounded-lg p-1 text-xs font-bold"
              >
                {BENGALI_MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Year dropdown */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-300 font-bold">বছর:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-slate-900 text-white border border-slate-600 rounded-lg p-1 text-xs font-bold"
              >
                <option value={2026}>২০২৬</option>
                <option value={2025}>২০২৫</option>
                <option value={2024}>২০২৪</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>মোট দিন: {toBengaliNumber(daysInMonth)} | উপস্থিত: {toBengaliNumber(stats.presentCount)} দিন | ওটি: {toBengaliNumber(stats.totalOtHours)} ঘণ্টা</span>
          </div>
        </div>

        {/* ================= SCROLLABLE CONTAINER FOR A4 SHEET ================= */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-5 bg-slate-200/90 flex justify-center">
          
          {/* ======================================================== */}
          {/* THE OFFICIAL SINGLE/TWO PAGE MONTHLY ATTENDANCE SHEET    */}
          {/* ======================================================== */}
          <div
            id="workerMonthlyAttendancePrintArea"
            ref={printContainerRef}
            className="bg-white text-slate-900 shadow-xl border border-slate-300 w-full max-w-[780px] p-5 sm:p-6 relative flex flex-col justify-between"
            style={{
              fontFamily: '"Noto Sans Bengali", "Kalpurush", sans-serif',
              boxSizing: 'border-box',
            }}
          >
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none z-0">
              <div className="text-center font-black tracking-widest text-slate-950 uppercase rotate-[-25deg]">
                <div className="text-5xl sm:text-6xl font-black">{factory.nameEn || 'TEXWARE APPARELS'}</div>
                <div className="text-lg mt-1 tracking-normal font-bold">মাসিক হাজিরা খাতা</div>
              </div>
            </div>

            <div className="relative z-10 space-y-2.5">
              
              {/* ================= 1. OFFICIAL FACTORY LETTERHEAD ================= */}
              <div className="border-b-2 border-slate-900 pb-2">
                <div className="flex items-start justify-between gap-3">
                  
                  {/* WORKER PHOTO (TOP-LEFT) */}
                  <div className="shrink-0 flex flex-col items-center">
                    <div className="w-[74px] h-[88px] border-2 border-slate-800 bg-slate-50 rounded p-0.5 shadow-xs flex flex-col items-center justify-center relative overflow-hidden">
                      {employee.photoUrl ? (
                        <img
                          src={safePhotoUrl || employee.photoUrl}
                          alt={employee.name}
                          crossOrigin="anonymous"
                          className="w-full h-full object-cover rounded-xs"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="text-center p-1 text-slate-400">
                          <User className="w-5 h-5 mx-auto mb-0.5 text-slate-300" />
                          <span className="text-[8px] font-bold block text-slate-500 leading-tight">
                            শ্রমিক ছবি
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CENTER: FACTORY NAME, ADDRESS, CONTACT */}
                  <div className="flex-1 text-center pr-1">
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 uppercase leading-tight">
                      {factory.name}
                    </h1>
                    {factory.nameEn && (
                      <div className="text-[10px] font-bold text-slate-700 tracking-wider uppercase mt-0.5">
                        {factory.nameEn}
                      </div>
                    )}
                    <p className="text-[10px] text-slate-800 leading-tight mt-1">
                      <MapPin className="w-2.5 h-2.5 inline-block text-slate-600 mr-0.5" />
                      {factory.address}
                    </p>
                    <p className="text-[9.5px] text-slate-700 mt-0.5">
                      <Phone className="w-2.5 h-2.5 inline-block text-slate-600 mr-0.5" />
                      ফোন: {factory.phone}
                    </p>
                  </div>

                  {/* RIGHT: MONTH & PRINT DATE BOX */}
                  <div className="shrink-0 w-36 text-right text-[10px] space-y-1">
                    <div className="border border-slate-300 rounded p-1 bg-slate-50 text-left">
                      <div className="text-[9px] text-slate-500 font-bold">হাজিরা মাস:</div>
                      <div className="font-bold text-blue-900 text-xs">
                        {selectedMonth} {toBengaliNumber(selectedYear)}
                      </div>
                      <div className="text-[9px] text-slate-500 font-bold mt-1">প্রিন্ট তারিখ:</div>
                      <div className="font-bold text-slate-800">{formatDateBn(new Date().toISOString().split('T')[0])}</div>
                    </div>
                  </div>
                </div>

                {/* TITLE BANNER */}
                <div className="mt-2 text-center">
                  <div className="inline-block bg-slate-900 text-white px-5 py-0.5 rounded font-black text-xs sm:text-sm tracking-wider uppercase shadow-xs">
                    শ্রমিকের মাসিক হাজিরা ও ইন-আউট পাঞ্চ লগ শিট
                  </div>
                  <div className="text-[9.5px] font-bold text-slate-600 mt-0.5">
                    (মাসিক বেতন, উপস্থিতি বোনাস ও ওভারটাইম হিসাবের জন্য প্রামাণ্য দলিল)
                  </div>
                </div>
              </div>

              {/* ================= 2. WORKER PROFILE CARD ================= */}
              <div className="border border-slate-300 rounded overflow-hidden text-[10.5px]">
                <table className="w-full border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <td className="w-1/4 p-1.5 font-bold text-slate-700 border-r border-slate-200">শ্রমিকের নাম:</td>
                      <td className="w-1/4 p-1.5 font-black text-slate-950 border-r border-slate-200">{employee.name}</td>
                      <td className="w-1/4 p-1.5 font-bold text-slate-700 border-r border-slate-200">কার্ড / আইডি নং:</td>
                      <td className="w-1/4 p-1.5 font-black text-blue-900 font-mono">{employee.workerId}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200">পদবি (Designation):</td>
                      <td className="p-1.5 font-bold text-slate-900 border-r border-slate-200">{employee.designation}</td>
                      <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200">সেকশন / বিভাগ:</td>
                      <td className="p-1.5 text-slate-900 font-medium">{employee.department || 'সাধারণ উৎপাদন'}</td>
                    </tr>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200">মাসিক মূল বেতন:</td>
                      <td className="p-1.5 font-bold text-slate-900 border-r border-slate-200">৳ {formatMoney(employee.salary)} টাকা</td>
                      <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200">যোগদানের তারিখ:</td>
                      <td className="p-1.5 font-medium text-slate-900">{formatDateBn(employee.joinDate)}</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200">মোবাইল নম্বর:</td>
                      <td className="p-1.5 font-medium text-slate-900 border-r border-slate-200">{employee.mobile || 'নেই'}</td>
                      <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200">জাতীয় পরিচয়পত্র:</td>
                      <td className="p-1.5 font-medium text-slate-900">{employee.nid || 'কারখানা ফাইলে সংরক্ষিত'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ================= 3. MONTHLY ATTENDANCE KPI SUMMARY ================= */}
              <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
                <div className="p-1.5 border border-slate-300 bg-slate-50 rounded">
                  <span className="block text-[9.5px] text-slate-600 font-bold">মাসের মোট দিন</span>
                  <span className="font-black text-sm text-slate-900">{toBengaliNumber(daysInMonth)} দিন</span>
                </div>
                <div className="p-1.5 border border-emerald-300 bg-emerald-50 rounded">
                  <span className="block text-[9.5px] text-emerald-800 font-bold">মোট উপস্থিতি</span>
                  <span className="font-black text-sm text-emerald-700">{toBengaliNumber(stats.presentCount)} দিন</span>
                </div>
                <div className="p-1.5 border border-rose-300 bg-rose-50 rounded">
                  <span className="block text-[9.5px] text-rose-800 font-bold">অনুপস্থিতি</span>
                  <span className="font-black text-sm text-rose-700">{toBengaliNumber(stats.absentCount)} দিন</span>
                </div>
                <div className="p-1.5 border border-amber-300 bg-amber-50 rounded">
                  <span className="block text-[9.5px] text-amber-800 font-bold">বিলম্ব / লেট</span>
                  <span className="font-black text-sm text-amber-700">{toBengaliNumber(stats.lateCount)} দিন</span>
                </div>
                <div className="p-1.5 border border-blue-300 bg-blue-50 rounded">
                  <span className="block text-[9.5px] text-blue-800 font-bold">ছুটি / লিভ</span>
                  <span className="font-black text-sm text-blue-700">{toBengaliNumber(stats.leaveCount + stats.halfDayCount)} দিন</span>
                </div>
                <div className="p-1.5 border border-purple-300 bg-purple-50 rounded">
                  <span className="block text-[9.5px] text-purple-800 font-bold">সাপ্তাহিক বন্ধ</span>
                  <span className="font-black text-sm text-purple-700">{toBengaliNumber(totalFridaysInMonth)} দিন</span>
                </div>
                <div className="p-1.5 border border-indigo-300 bg-indigo-50 rounded">
                  <span className="block text-[9.5px] text-indigo-900 font-black">মোট ওভারটাইম</span>
                  <span className="font-black text-sm text-indigo-700">{toBengaliNumber(stats.totalOtHours)} ঘণ্টা</span>
                </div>
              </div>

              {/* ================= 4. FULL CALENDAR DAY-BY-DAY TABLE ================= */}
              <div>
                <div className="text-[10px] font-bold text-slate-800 mb-0.5 flex items-center justify-between">
                  <span>মাসিক দৈনিক হাজিরা ও পাঞ্চিং বিবরণী (১ হতে {toBengaliNumber(daysInMonth)} তারিখ):</span>
                  <span className="text-[9px] text-slate-500 font-normal">*শুক্রবার কারখানা সাপ্তাহিক বন্ধ (শুক্রবার দায়িত্ব পালন করলে দুপুর ১:০০ হতে ২:০০টা পর্যন্ত ১ ঘণ্টা বিরতি বাদ দিয়ে সম্পূর্ণ ওটি গণ্য হয়)</span>
                </div>

                <div className="border border-slate-300 rounded overflow-hidden text-[10px]">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-800 text-white font-bold">
                        <th className="p-1 text-center w-8 border-r border-slate-700">তারিখ</th>
                        <th className="p-1 text-center w-16 border-r border-slate-700">বার</th>
                        <th className="p-1 text-center w-24 border-r border-slate-700">হাজিরা স্ট্যাটাস</th>
                        <th className="p-1 text-center w-16 border-r border-slate-700">ইন টাইম</th>
                        <th className="p-1 text-center w-16 border-r border-slate-700">আউট টাইম</th>
                        <th className="p-1 text-center w-16 border-r border-slate-700">বিলম্ব/লেট</th>
                        <th className="p-1 text-center w-16 border-r border-slate-700">ওভারটাইম</th>
                        <th className="p-1 text-left">মন্তব্য / দায়িত্ব নোট</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calendarDays.map((day) => {
                        const rec = day.record;
                        const isFri = day.isFriday;

                        let statusLabel = '—';
                        let statusColorClass = 'text-slate-500';
                        let inTimeStr = '—';
                        let outTimeStr = '—';
                        let lateStr = '—';
                        let otStr = '০';
                        let noteStr = '—';

                        if (rec) {
                          const badge = getAttendanceStatusBadge(rec.status, rec.date, rec.otHours);
                          statusLabel = badge.label;
                          inTimeStr = formatTime12h(rec.inTime);
                          outTimeStr = formatTime12h(rec.outTime);

                          if (!isFri && (rec.isLate || rec.lateMinutes)) {
                            lateStr = `${toBengaliNumber(rec.lateMinutes || 0)} মি.`;
                          }

                          if (rec.otHours && rec.otHours > 0) {
                            otStr = `${toBengaliNumber(rec.otHours)} ঘ.`;
                          }

                          noteStr = rec.note || (isFri && rec.otHours ? 'শুক্রবার ওটি (১টা-২টা বিরতি বাদ)' : '');

                          if (rec.status === 'present') {
                            statusColorClass = 'text-emerald-700 font-bold';
                          } else if (rec.status === 'late') {
                            statusColorClass = 'text-amber-700 font-bold';
                          } else if (rec.status === 'absent') {
                            statusColorClass = 'text-rose-700 font-bold';
                          } else if (rec.status === 'leave') {
                            statusColorClass = 'text-blue-700 font-bold';
                          } else if (rec.status === 'half_day') {
                            statusColorClass = 'text-orange-700 font-bold';
                          } else if (isFri && rec.otHours) {
                            statusColorClass = 'text-indigo-800 font-bold';
                          }
                        } else {
                          // No record in DB
                          if (isFri) {
                            statusLabel = 'সাপ্তাহিক ছুটি';
                            statusColorClass = 'text-purple-700 font-bold';
                            noteStr = 'শুক্রবার বন্ধ';
                          } else {
                            statusLabel = '—';
                          }
                        }

                        const rowBg = isFri
                          ? 'bg-purple-50/60 font-semibold'
                          : day.dayNumber % 2 === 0
                          ? 'bg-slate-50/70'
                          : 'bg-white';

                        return (
                          <tr
                            key={day.dayNumber}
                            className={`border-b border-slate-200 ${rowBg}`}
                          >
                            <td className="p-0.5 text-center font-bold border-r border-slate-200">
                              {toBengaliNumber(day.dayNumber)}
                            </td>
                            <td className={`p-0.5 text-center border-r border-slate-200 ${isFri ? 'text-purple-800 font-bold' : 'text-slate-700'}`}>
                              {day.dayName}
                            </td>
                            <td className={`p-0.5 text-center border-r border-slate-200 ${statusColorClass}`}>
                              {statusLabel}
                            </td>
                            <td className="p-0.5 text-center border-r border-slate-200 font-medium text-slate-800">
                              {inTimeStr}
                            </td>
                            <td className="p-0.5 text-center border-r border-slate-200 font-medium text-slate-800">
                              {outTimeStr}
                            </td>
                            <td className="p-0.5 text-center border-r border-slate-200 text-amber-700 font-bold">
                              {lateStr}
                            </td>
                            <td className="p-0.5 text-center border-r border-slate-200 font-black text-indigo-700">
                              {otStr}
                            </td>
                            <td className="p-0.5 text-slate-700 text-[9.5px] truncate max-w-[140px]">
                              {noteStr}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ================= 5. OFFICIAL SIGNATURES BLOCK ================= */}
              <div className="pt-4">
                <div className="grid grid-cols-5 gap-2 text-center text-[9px]">
                  
                  {/* 1. Worker Signature */}
                  <div className="flex flex-col justify-end">
                    <div className="h-8 flex items-end justify-center pb-1">
                      <span className="text-[8.5px] text-slate-400 italic">স্বাক্ষর / টিপসহি</span>
                    </div>
                    <div className="border-t border-slate-800 pt-1 font-bold text-slate-900">
                      শ্রমিকের স্বাক্ষর
                    </div>
                    <div className="text-[8px] text-slate-500 mt-0.5">তারিখ: ____________</div>
                  </div>

                  {/* 2. Line Supervisor */}
                  <div className="flex flex-col justify-end">
                    <div className="h-8 flex items-end justify-center pb-1">
                      <span className="text-[8.5px] text-slate-400 italic">যাচাইকৃত</span>
                    </div>
                    <div className="border-t border-slate-800 pt-1 font-bold text-slate-900">
                      লাইন সুপারভাইজার
                    </div>
                    <div className="text-[8px] text-slate-500 mt-0.5">স্বাক্ষর ও সিল</div>
                  </div>

                  {/* 3. HR & Attendance Officer */}
                  <div className="flex flex-col justify-end">
                    <div className="h-8 flex items-end justify-center pb-1">
                      <span className="text-[8.5px] text-slate-400 italic">অনুমোদিত</span>
                    </div>
                    <div className="border-t border-slate-800 pt-1 font-bold text-slate-900">
                      এইচআর ও হাজিরা শাখা
                    </div>
                    <div className="text-[8px] text-slate-500 mt-0.5">লগ পরীক্ষণ সম্পন্ন</div>
                  </div>

                  {/* 4. Accounts & Payroll */}
                  <div className="flex flex-col justify-end">
                    <div className="h-8 flex items-end justify-center pb-1">
                      <span className="text-[8.5px] text-slate-400 italic">বিল তৈরিকৃত</span>
                    </div>
                    <div className="border-t border-slate-800 pt-1 font-bold text-slate-900">
                      হিসাব ও পে-রোল শাখা
                    </div>
                    <div className="text-[8px] text-slate-500 mt-0.5">বেতন সমন্বয়</div>
                  </div>

                  {/* 5. Factory Manager */}
                  <div className="flex flex-col justify-end">
                    <div className="h-8 flex items-end justify-center pb-1">
                      <span className="text-[8.5px] text-slate-400 italic">চূড়ান্ত অনুমোদন</span>
                    </div>
                    <div className="border-t border-slate-800 pt-1 font-black text-slate-950">
                      কারখানা প্রধান / এমডি
                    </div>
                    <div className="text-[8px] text-slate-500 mt-0.5">অনুমোদন সিলমোহর</div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ================= BOTTOM CONTROL BAR (NO-PRINT) ================= */}
        <div className="bg-white border-t border-slate-300 p-2.5 sm:px-4 flex items-center justify-between no-print">
          <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>মাস শেষে প্রতিটি কর্মীর হাজিরা আলাদা আলাদা ১-ক্লিকে প্রিন্ট করা যাবে।</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-1.5 px-3 rounded-lg text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
            >
              বন্ধ করুন
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="py-1.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>১-ক্লিকে এখনই প্রিন্ট করুন</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
