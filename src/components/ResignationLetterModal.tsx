import React, { useState, useEffect, useRef } from 'react';
import { Employee, FactorySettings } from '../types';
import { formatMoney, formatDateBn, toBengaliNumber } from '../lib/utils';
import { printElement } from '../lib/printer';
import {
  loadFactorySettings,
  DEFAULT_FACTORY_SETTINGS,
  saveOrUpdateEmployee,
} from '../lib/firebase';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  Printer,
  X,
  Camera,
  Upload,
  FileSignature,
  CheckCircle2,
  Building2,
  Phone,
  MapPin,
  FileText,
  FileDown,
  Image as ImageIcon,
  Loader2,
  Edit3,
  Calendar,
  UserCheck,
  RotateCcw,
} from 'lucide-react';

interface ResignationLetterModalProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
  onEmployeeUpdated?: (updatedEmp: Employee) => void;
  autoPrint?: boolean;
}

export const ResignationLetterModal: React.FC<ResignationLetterModalProps> = ({
  employee,
  isOpen,
  onClose,
  showToast,
  onEmployeeUpdated,
  autoPrint = false,
}) => {
  const letterPrintRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Factory settings state
  const [factory, setFactory] = useState<FactorySettings>(DEFAULT_FACTORY_SETTINGS);
  
  // Customization state for quick inline tweak before print
  const [isEditingForm, setIsEditingForm] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState<string>('');
  const [resignationReason, setResignationReason] = useState<string>('');
  const [noticeDetails, setNoticeDetails] = useState<string>('');
  const [clearanceStatus, setClearanceStatus] = useState<boolean>(true);
  const [customRemarks, setCustomRemarks] = useState<string>('');

  // Download & Export loading states
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [safePhotoUrl, setSafePhotoUrl] = useState<string | undefined>(employee?.photoUrl);
  const [safeSignatureUrl, setSafeSignatureUrl] = useState<string | undefined>(employee?.signatureUrl);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  // Pre-load factory settings
  useEffect(() => {
    if (isOpen) {
      loadFactorySettings().then((settings) => {
        if (settings) {
          setFactory(settings);
        }
      });
    }
  }, [isOpen]);

  // Synchronize state when employee changes
  useEffect(() => {
    if (employee) {
      setEffectiveDate(employee.resignationDate || new Date().toISOString().split('T')[0]);
      setResignationReason(employee.resignationReason || 'পারিবারিক ও ব্যক্তিগত কারণে অব্যাহতি গ্রহণ');
      setNoticeDetails(
        employee.noticeServed === 'yes'
          ? 'শ্রম আইন অনুযায়ী নোটিশ প্রদান করা হয়েছে'
          : employee.noticeServed === 'partial'
          ? 'আংশিক নোটিশ প্রদান করা হয়েছে'
          : 'তাৎক্ষণিক পদত্যাগ'
      );
      setClearanceStatus(Boolean(employee.clearanceDone));
      setCustomRemarks(employee.finalSettlementNote || '');
    }
  }, [employee]);

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
            canvas.width = img.naturalWidth || 84;
            canvas.height = img.naturalHeight || 100;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const dataUrl = canvas.toDataURL('image/png');
              if (!isCancelled) setSafePhotoUrl(dataUrl);
              return;
            }
          } catch {
            // CORS fallback
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

  // Safe signature base64 cache
  useEffect(() => {
    let isCancelled = false;
    if (employee?.signatureUrl) {
      if (employee.signatureUrl.startsWith('data:')) {
        setSafeSignatureUrl(employee.signatureUrl);
      } else {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || 160;
            canvas.height = img.naturalHeight || 60;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const dataUrl = canvas.toDataURL('image/png');
              if (!isCancelled) setSafeSignatureUrl(dataUrl);
              return;
            }
          } catch {}
          if (!isCancelled) setSafeSignatureUrl(employee.signatureUrl);
        };
        img.onerror = () => {
          if (!isCancelled) setSafeSignatureUrl(employee.signatureUrl);
        };
        img.src = employee.signatureUrl;
      }
    } else {
      setSafeSignatureUrl(undefined);
    }
    return () => {
      isCancelled = true;
    };
  }, [employee?.signatureUrl]);

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;

    if (!file.type.startsWith('image/')) {
      showToast('অনুগ্রহ করে শুধুমাত্র ছবি ফাইল নির্বাচন করুন');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      showToast('ছবির সাইজ ৩ মেগাবাইটের কম হতে হবে');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const payload: Omit<Employee, 'id'> = {
          name: employee.name,
          workerId: employee.workerId,
          designation: employee.designation,
          department: employee.department,
          salary: employee.salary,
          otRate: employee.otRate,
          joinDate: employee.joinDate,
          birthDate: employee.birthDate,
          nid: employee.nid,
          mobile: employee.mobile,
          address: employee.address,
          photoUrl: base64,
          signatureUrl: employee.signatureUrl,
          bankName: employee.bankName,
          accountName: employee.accountName,
          accountNumber: employee.accountNumber,
          bankBranch: employee.bankBranch,
          status: employee.status,
          resignationDate: employee.resignationDate,
          resignationReason: employee.resignationReason,
          noticeServed: employee.noticeServed,
          clearanceDone: employee.clearanceDone,
          finalSettlementPaid: employee.finalSettlementPaid,
          finalSettlementNote: employee.finalSettlementNote,
        };
        await saveOrUpdateEmployee(payload, employee.id);
        const updated: Employee = { ...employee, photoUrl: base64 };
        onEmployeeUpdated?.(updated);
        showToast('✓ শ্রমিকের ছবি সফলভাবে যুক্ত হয়েছে');
      } catch (err) {
        showToast('ছবি সংরক্ষণ করতে সমস্যা হয়েছে');
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Signature Upload
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;

    if (file.size > 2.5 * 1024 * 1024) {
      showToast('স্বাক্ষর ফাইলের সাইজ ২.৫ মেগাবাইটের কম হতে হবে');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const payload: Omit<Employee, 'id'> = {
          name: employee.name,
          workerId: employee.workerId,
          designation: employee.designation,
          department: employee.department,
          salary: employee.salary,
          otRate: employee.otRate,
          joinDate: employee.joinDate,
          birthDate: employee.birthDate,
          nid: employee.nid,
          mobile: employee.mobile,
          address: employee.address,
          photoUrl: employee.photoUrl,
          signatureUrl: base64,
          bankName: employee.bankName,
          accountName: employee.accountName,
          accountNumber: employee.accountNumber,
          bankBranch: employee.bankBranch,
          status: employee.status,
          resignationDate: employee.resignationDate,
          resignationReason: employee.resignationReason,
          noticeServed: employee.noticeServed,
          clearanceDone: employee.clearanceDone,
          finalSettlementPaid: employee.finalSettlementPaid,
          finalSettlementNote: employee.finalSettlementNote,
        };
        await saveOrUpdateEmployee(payload, employee.id);
        const updated: Employee = { ...employee, signatureUrl: base64 };
        onEmployeeUpdated?.(updated);
        showToast('✓ শ্রমিকের স্বাক্ষর সফলভাবে পদত্যাগপত্রে যুক্ত হয়েছে');
      } catch (err) {
        showToast('স্বাক্ষর সংরক্ষণ করতে সমস্যা হয়েছে');
      }
    };
    reader.readAsDataURL(file);
  };

  // 1-Click Print Handler
  const handlePrint = () => {
    if (letterPrintRef.current && employee) {
      printElement(
        letterPrintRef.current,
        `Resignation_Letter_${employee.workerId || 'Worker'}_${employee.name}`,
        'contract'
      );
    } else {
      window.print();
    }
  };

  // Auto-print support if requested via prop
  useEffect(() => {
    if (isOpen && autoPrint && employee) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoPrint, employee]);

  // 1-Click PDF Download
  const handleDownloadPDF = async () => {
    if (!letterPrintRef.current || !employee) return;
    setIsDownloadingPDF(true);
    showToast('পিডিএফ তৈরি হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...');

    try {
      const element = letterPrintRef.current;
      const originalWidth = element.style.width;
      const originalMaxWidth = element.style.maxWidth;
      element.style.width = '790px';
      element.style.maxWidth = '790px';

      const canvas = await html2canvas(element, {
        scale: 2.5,
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
      pdf.save(`Resignation_Form_${employee.workerId || 'Worker'}_${employee.name}.pdf`);
      showToast('✓ পদত্যাগ ফরম PDF সফলভাবে ডাউনলোড হয়েছে');
    } catch (err) {
      console.error('PDF error:', err);
      showToast('পিডিএফ তৈরি করতে সমস্যা হয়েছে');
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  // 1-Click Image Download
  const handleDownloadImage = async () => {
    if (!letterPrintRef.current || !employee) return;
    setIsDownloadingImage(true);
    showToast('HD ছবি তৈরি হচ্ছে...');

    try {
      const element = letterPrintRef.current;
      const originalWidth = element.style.width;
      const originalMaxWidth = element.style.maxWidth;
      element.style.width = '790px';
      element.style.maxWidth = '790px';

      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      element.style.width = originalWidth;
      element.style.maxWidth = originalMaxWidth;

      canvas.toBlob((blob) => {
        if (!blob) {
          showToast('ছবি তৈরি করতে সমস্যা হয়েছে');
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Resignation_Form_${employee.workerId || 'Worker'}_${employee.name}.png`;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 1500);
        showToast('✓ পদত্যাগ ফরম HD ছবি সফলভাবে ডাউনলোড হয়েছে');
      }, 'image/png');
    } catch (err) {
      console.error('Image error:', err);
      showToast('ছবি ডাউনলোড করতে সমস্যা হয়েছে');
    } finally {
      setIsDownloadingImage(false);
    }
  };

  if (!isOpen || !employee) return null;

  const appDateStr = formatDateBn(effectiveDate || employee.resignationDate || new Date().toISOString().split('T')[0]);
  const joinDateStr = formatDateBn(employee.joinDate || '');
  const refNo = `TW/HR-RES/${employee.workerId || '00'}/${new Date().getFullYear()}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:bg-white print:p-0 print:m-0 print:static print:overflow-visible">
      {/* Strict Print CSS for full single-page rendering without clipping */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 3mm 5mm 3mm 5mm;
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
          #workerResignationLetterA4Area {
            border: none !important;
            box-shadow: none !important;
            padding: 2.5mm 4mm !important;
            margin: 0 auto !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="bg-slate-100 rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-300 my-auto flex flex-col max-h-[96vh] overflow-hidden print:max-h-none print:overflow-visible print:border-none print:shadow-none print:bg-white print:m-0 print:p-0 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Control Bar (No-Print) */}
        <div className="bg-slate-900 text-white p-2.5 sm:px-4 flex items-center justify-between gap-2 shrink-0 shadow-sm no-print">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-600/30 text-rose-400 border border-rose-500/40">
              <FileText className="w-5 h-5 shrink-0" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black flex items-center gap-1.5">
                <span>শ্রমিক পদত্যাগপত্র / ইস্তফা ফরম (১-ক্লিক প্রিন্ট)</span>
                <span className="text-[10px] bg-rose-600 text-white px-1.5 py-0.2 rounded font-bold">
                  A4 সিঙ্গেল পেজ
                </span>
              </h2>
              <p className="text-[10px] text-slate-300">
                {employee.name} — কার্ড: {employee.workerId} ({employee.designation})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Hidden File Input for Photo Upload */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer border border-slate-700"
              title="শ্রমিকের ছবি পরিবর্তন করুন"
            >
              <Camera className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">{employee.photoUrl ? 'ছবি পরিবর্তন' : 'ছবি যোগ'}</span>
            </button>

            {/* Hidden File Input for Signature Upload */}
            <input
              type="file"
              ref={signatureInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleSignatureUpload}
            />

            <button
              type="button"
              onClick={() => signatureInputRef.current?.click()}
              className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer border border-slate-700"
              title="শ্রমিকের ডিজিটাল স্বাক্ষর নির্বাচন করুন"
            >
              <FileSignature className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">{employee.signatureUrl ? 'স্বাক্ষর পরিবর্তন' : 'স্বাক্ষর যোগ'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsEditingForm(!isEditingForm)}
              className={`py-1 px-2.5 rounded-lg font-bold text-[11px] flex items-center gap-1 transition cursor-pointer border ${
                isEditingForm
                  ? 'bg-rose-600 text-white border-rose-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700'
              }`}
              title="পদত্যাগের তথ্য দ্রুত কাস্টমাইজ করুন"
            >
              <Edit3 className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">তথ্য সম্পাদন</span>
            </button>

            <button
              type="button"
              disabled={isDownloadingPDF}
              onClick={handleDownloadPDF}
              className="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
              title="পদত্যাগ ফরম PDF ডাউনলোড করুন"
            >
              {isDownloadingPDF ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-white" />
              )}
              <span className="hidden sm:inline">PDF</span>
            </button>

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

        {/* Quick Inline Adjustment Drawer (No-Print) */}
        {isEditingForm && (
          <div className="bg-rose-50 border-b border-rose-200 p-3 sm:px-5 text-xs text-rose-950 space-y-2 no-print shrink-0 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-rose-700" />
                <span>প্রিন্ট করার পূর্বে পদত্যাগের তারিখ বা কারণ সাময়িক পরিবর্তন:</span>
              </span>
              <button
                type="button"
                onClick={() => setIsEditingForm(false)}
                className="text-rose-800 hover:text-rose-950 font-bold"
              >
                ✕ বন্ধ
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">পদত্যাগের কার্যকর তারিখ</label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="w-full p-1.5 bg-white border border-rose-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">পদত্যাগের কারণ</label>
                <input
                  type="text"
                  value={resignationReason}
                  onChange={(e) => setResignationReason(e.target.value)}
                  placeholder="যেমন: পারিবারিক সমস্যা বা নিজ গ্রামে ফেরা"
                  className="w-full p-1.5 bg-white border border-rose-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">নোটিশ সংক্রান্ত বিবরণ</label>
                <input
                  type="text"
                  value={noticeDetails}
                  onChange={(e) => setNoticeDetails(e.target.value)}
                  placeholder="যেমন: ১ মাসের লিখিত নোটিশ প্রদানকৃত"
                  className="w-full p-1.5 bg-white border border-rose-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-rose-200">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={clearanceStatus}
                  onChange={(e) => setClearanceStatus(e.target.checked)}
                  className="rounded text-rose-600"
                />
                <span>আইডি কার্ড ও কারখানা সরঞ্জাম সম্পূর্ণ জমা প্রদান নিশ্চিত</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setIsEditingForm(false);
                  showToast('ফরমের তথ্য আপডেট হয়েছে');
                }}
                className="py-1 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs"
              >
                সম্পন্ন
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Container with Printable A4 Page */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-5 bg-slate-200/90 flex justify-center">
          
          {/* ======================================================== */}
          {/* THE OFFICIAL SINGLE-PAGE A4 RESIGNATION FORM            */}
          {/* Strictly structured for 1-page standard A4 print/export   */}
          {/* ======================================================== */}
          <div
            id="workerResignationLetterA4Area"
            ref={letterPrintRef}
            className="bg-white text-slate-900 shadow-xl border border-slate-300 w-full max-w-[780px] p-5 sm:p-6 relative flex flex-col justify-between"
            style={{
              fontFamily: '"Noto Sans Bengali", "Kalpurush", sans-serif',
              boxSizing: 'border-box',
            }}
          >
            {/* Subtle Official Watermark Background */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none z-0">
              <div className="text-center font-black tracking-widest text-slate-950 uppercase rotate-[-25deg]">
                <div className="text-5xl sm:text-6xl font-black">{factory.nameEn || 'TEXWARE APPARELS'}</div>
                <div className="text-lg mt-1 tracking-normal font-bold">শ্রমিক পদত্যাগপত্র ফরম</div>
              </div>
            </div>

            <div className="relative z-10 space-y-2">
              
              {/* ================= 1. OFFICIAL FACTORY LETTERHEAD ================= */}
              <div className="border-b-2 border-slate-900 pb-2">
                <div className="flex items-start justify-between gap-3">
                  
                  {/* WORKER PASSPORT PHOTO (TOP-LEFT CORNER) */}
                  <div className="shrink-0 flex flex-col items-center">
                    <div className="w-[82px] h-[98px] border-2 border-slate-800 bg-slate-50 rounded p-0.5 shadow-xs flex flex-col items-center justify-center relative overflow-hidden">
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
                          <Camera className="w-5 h-5 mx-auto mb-0.5 text-slate-300" />
                          <span className="text-[8px] font-bold block text-slate-500 leading-tight">
                            পাসপোর্ট ছবি
                          </span>
                          <span className="text-[7px] text-slate-400 block mt-0.5">
                            (১ কপি সত্যায়িত)
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Photo change button for web UI (no-print) */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="no-print mt-1 text-[9px] text-blue-700 hover:text-blue-900 font-bold flex items-center gap-0.5 cursor-pointer bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200"
                    >
                      <Upload className="w-2.5 h-2.5" />
                      <span>{employee.photoUrl ? 'ছবি পরিবর্তন' : 'ছবি যোগ'}</span>
                    </button>
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
                      {factory.email && ` • ইমেইল: ${factory.email}`}
                    </p>
                    <div className="mt-1 text-[9px] text-slate-600 font-bold tracking-wide">
                      মানবসম্পদ ও প্রশাসন বিভাগ (Human Resources & Administration Dept.)
                    </div>
                  </div>

                  {/* RIGHT CORNER: MEMO & DATE BOX */}
                  <div className="shrink-0 w-36 text-right text-[10px] space-y-1">
                    <div className="border border-slate-300 rounded p-1 bg-slate-50 text-left">
                      <div className="text-[9px] text-slate-500 font-bold">স্মারক নং:</div>
                      <div className="font-mono font-bold text-slate-800 text-[9.5px]">{refNo}</div>
                      <div className="text-[9px] text-slate-500 font-bold mt-1">আবেদনের তারিখ:</div>
                      <div className="font-bold text-slate-900">{appDateStr}</div>
                    </div>
                  </div>
                </div>

                {/* OFFICIAL TITLE BANNER */}
                <div className="mt-2 text-center">
                  <div className="inline-block bg-slate-900 text-white px-5 py-0.5 rounded font-black text-xs sm:text-sm tracking-wider uppercase shadow-xs">
                    শ্রমিকের পদত্যাগপত্র / ইস্তফা ফরম (RESIGNATION FORM)
                  </div>
                  <div className="text-[9.5px] font-bold text-slate-600 mt-0.5">
                    (বাংলাদেশ শ্রম আইন ২০০৬ ও শ্রম বিধিমালা ২০১৫ অনুযায়ী প্রস্তুতকৃত)
                  </div>
                </div>
              </div>

              {/* ================= 2. RECIPIENT & SUBJECT ================= */}
              <div className="text-[11px] leading-relaxed border-b border-slate-200 pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-900">বরাবর,</p>
                    <p className="font-semibold text-slate-800">ব্যবস্থাপনা পরিচালক / কারখানা প্রধান / মানবসম্পদ বিভাগ,</p>
                    <p className="text-slate-700">{factory.name}, {factory.address}।</p>
                  </div>
                  <div className="text-right text-[10.5px]">
                    <span className="bg-rose-50 text-rose-800 border border-rose-200 font-bold px-2 py-0.5 rounded text-[10px]">
                      সেকশন: {employee.department || 'সাধারণ উৎপাদন'}
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 font-bold text-slate-900 bg-slate-100 p-1.5 rounded border border-slate-200 flex items-center justify-between">
                  <span>বিষয়: <span className="underline decoration-slate-600 font-black">স্বেচ্ছায় চাকরি হতে পদত্যাগ বা অব্যাহতি প্রদান প্রসঙ্গে।</span></span>
                  <span className="text-[10px] font-normal text-slate-600">কার্ড নং: <b>{employee.workerId}</b></span>
                </div>
              </div>

              {/* ================= 3. COMPLETE WORKER INFORMATION GRID ================= */}
              <div>
                <div className="text-[10.5px] font-bold text-slate-900 mb-1 flex items-center justify-between">
                  <span>১. পদত্যাগকারী শ্রমিকের তথ্যাবলি (Employee Profile):</span>
                  <span className="text-[9.5px] font-normal text-slate-600">কারখানা রেজিস্ট্রি অনুযায়ী চূড়ান্ত তথ্য</span>
                </div>

                <div className="border border-slate-300 rounded overflow-hidden text-[10.5px]">
                  <table className="w-full border-collapse">
                    <tbody>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <td className="w-1/4 p-1.5 font-bold text-slate-700 border-r border-slate-200">শ্রমিকের পূর্ণ নাম:</td>
                        <td className="w-1/4 p-1.5 font-bold text-slate-900 border-r border-slate-200">{employee.name}</td>
                        <td className="w-1/4 p-1.5 font-bold text-slate-700 border-r border-slate-200">কার্ড / আইডি নং:</td>
                        <td className="w-1/4 p-1.5 font-black text-rose-900 font-mono">{employee.workerId}</td>
                      </tr>
                      <tr className="border-b border-slate-200">
                        <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200">পদবি (Designation):</td>
                        <td className="p-1.5 font-bold text-slate-900 border-r border-slate-200">{employee.designation}</td>
                        <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200">বিভাগ / সেকশন:</td>
                        <td className="p-1.5 text-slate-900">{employee.department || 'উৎপাদন শাখা'}</td>
                      </tr>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200">যোগদানের তারিখ:</td>
                        <td className="p-1.5 font-medium text-slate-900 border-r border-slate-200">{joinDateStr || 'অনুল্লিখিত'}</td>
                        <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200">কার্যকর পদত্যাগ তারিখ:</td>
                        <td className="p-1.5 font-bold text-rose-800">{appDateStr}</td>
                      </tr>
                      <tr className="border-b border-slate-200">
                        <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200">মাসিক মূল বেতন:</td>
                        <td className="p-1.5 font-bold text-slate-900 border-r border-slate-200">৳ {formatMoney(employee.salary)} টাকা</td>
                        <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200">মোবাইল নম্বর:</td>
                        <td className="p-1.5 font-semibold text-slate-900">{employee.mobile || 'নেই'}</td>
                      </tr>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200">জাতীয় পরিচয়পত্র / NID:</td>
                        <td className="p-1.5 font-medium text-slate-900 border-r border-slate-200">{employee.nid || 'কারখানা রেকর্ডে সংরক্ষিত'}</td>
                        <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200">ওভারটাইম প্রতি ঘণ্টা:</td>
                        <td className="p-1.5 font-medium text-slate-900">৳ {formatMoney(employee.otRate)} টাকা</td>
                      </tr>
                      <tr>
                        <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200">বর্তমান ও স্থায়ী ঠিকানা:</td>
                        <td colSpan={3} className="p-1.5 text-slate-800">
                          {employee.address || 'কারখানার ব্যক্তিগত ফাইল ও সার্ভিস বুক অনুযায়ী সংরক্ষিত ঠিকানা'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ================= 4. FORMAL LETTER STATEMENT ================= */}
              <div className="border border-slate-300 rounded p-2 bg-slate-50/50 text-[11px] leading-relaxed text-slate-900 space-y-1.5">
                <p>
                  <b>জনাব,</b>
                </p>
                <p className="text-justify indent-4">
                  সবিনয় নিবেদন এই যে, আমি নিম্নস্বাক্ষরকারী <b>{employee.name}</b> (কার্ড নং: <b>{employee.workerId}</b>), 
                  আপনার কারখানায় <b>{employee.designation}</b> পদে <b>{joinDateStr || 'নির্ধারিত'}</b> তারিখ হতে নিষ্ঠার সাথে দায়িত্ব পালন করে আসছি। 
                  বর্তমানে আমার <b>"{resignationReason}"</b> জনিত কারণে অত্র কারখানায় আমার পক্ষে আর চাকরিতে বহাল থাকা সম্ভব হচ্ছে না।
                </p>
                <p className="text-justify indent-4">
                  এমতাবস্থায়, অত্র আবেদনের মাধ্যমে আগামী <b>{appDateStr}</b> খ্রিঃ তারিখ হতে আমি আমার পদ থেকে স্বেচ্ছায় পদত্যাগ করলাম। 
                  কারখানার কোনো দায়িত্ব, মালামাল বা পাওনাদি বকেয়া থাকলে তা দায়িত্বশীল কর্তৃপক্ষের নিকট বুঝিয়ে দিতে আমি সম্পূর্ণ প্রস্তুত।
                </p>
                <p className="text-justify indent-4">
                  অতএব, মহোদয়ের নিকট আকুল আবেদন, আমার এই পদত্যাগপত্র সাদরে গ্রহণ পূর্বক আমাকে চাকরি হতে অব্যাহতি প্রদান করতে এবং বাংলাদেশ শ্রম আইন অনুযায়ী 
                  আমার অর্জিত বকেয়া বেতন ও সার্ভিস সুবিধাদি চূড়ান্ত নিষ্পত্তি (Final Settlement) করে বাধিত করবেন।
                </p>
              </div>

              {/* ================= 5. CLEARANCE & HANDOVER RECORD ================= */}
              <div className="border border-slate-300 rounded p-2 text-[10px] space-y-1">
                <div className="font-bold text-slate-900 flex items-center justify-between border-b border-slate-200 pb-1">
                  <span>২. কারখানা ছাড়পত্র, সরঞ্জাম প্রত্যর্পণ ও নোটিশ বিবরণী (Clearance & Handover):</span>
                  <span className="font-mono text-emerald-800 font-bold">
                    {clearanceStatus ? '[✓ ক্লিয়ারেন্স সম্পন্ন]' : '[ক্লিয়ারেন্স প্রক্রিয়াধীন]'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
                  <div className="bg-slate-50 p-1 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[9px]">কারখানা আইডি কার্ড:</span>
                    <span className="font-bold text-slate-800">
                      {clearanceStatus ? '✓ জমা দেওয়া হয়েছে' : 'জমা সাপেক্ষে'}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-1 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[9px]">পোশাক ও টুলস/মালামাল:</span>
                    <span className="font-bold text-slate-800">
                      {clearanceStatus ? '✓ ক্লিয়ারেন্স গৃহীত' : 'জমা সাপেক্ষে'}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-1 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[9px]">নোটিশের স্ট্যাটাস:</span>
                    <span className="font-bold text-slate-800">{noticeDetails}</span>
                  </div>
                  <div className="bg-slate-50 p-1 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[9px]">চূড়ান্ত পাওনা নিষ্পত্তি:</span>
                    <span className="font-bold text-slate-800">
                      {employee.finalSettlementPaid ? '✓ সম্পূর্ণ পরিশোধিত' : 'হিসাব শাখা কর্তৃক প্রক্রিয়াধীন'}
                    </span>
                  </div>
                </div>
                {customRemarks && (
                  <div className="text-[9.5px] text-slate-600 italic pt-0.5">
                    বিশেষ মন্তব্য/নোট: {customRemarks}
                  </div>
                )}
              </div>

              {/* ================= 6. OFFICIAL SIGNATURES BLOCK ================= */}
              <div className="pt-3">
                <div className="grid grid-cols-5 gap-2 text-center text-[9px]">
                  
                  {/* 1. Worker Signature */}
                  <div className="flex flex-col justify-end">
                    <div className="h-9 flex items-end justify-center pb-1">
                      {safeSignatureUrl || employee.signatureUrl ? (
                        <img
                          src={safeSignatureUrl || employee.signatureUrl}
                          alt="শ্রমিকের স্বাক্ষর"
                          className="max-h-8 max-w-[110px] object-contain"
                        />
                      ) : (
                        <span className="text-[9px] text-slate-400 italic">স্বাক্ষর / টিপসহি</span>
                      )}
                    </div>
                    <div className="border-t border-slate-800 pt-1 font-bold text-slate-900">
                      আবেদনকারী শ্রমিকের স্বাক্ষর
                    </div>
                    <div className="text-[8px] text-slate-500 mt-0.5">
                      তারিখ: {appDateStr}
                    </div>
                  </div>

                  {/* 2. Line Supervisor */}
                  <div className="flex flex-col justify-end">
                    <div className="h-9 flex items-end justify-center pb-1">
                      <span className="text-[9px] text-slate-400 italic">সুপারিশকৃত</span>
                    </div>
                    <div className="border-t border-slate-800 pt-1 font-bold text-slate-900">
                      লাইন সুপারভাইজার / ইনচার্জ
                    </div>
                    <div className="text-[8px] text-slate-500 mt-0.5">স্বাক্ষর ও সিল</div>
                  </div>

                  {/* 3. HR & Admin */}
                  <div className="flex flex-col justify-end">
                    <div className="h-9 flex items-end justify-center pb-1">
                      <span className="text-[9px] text-slate-400 italic">যাচাইকৃত</span>
                    </div>
                    <div className="border-t border-slate-800 pt-1 font-bold text-slate-900">
                      এইচআর ও প্রশাসন কর্মকর্তা
                    </div>
                    <div className="text-[8px] text-slate-500 mt-0.5">ক্লিয়ারেন্স অনুমোদন</div>
                  </div>

                  {/* 4. Accounts & Finance */}
                  <div className="flex flex-col justify-end">
                    <div className="h-9 flex items-end justify-center pb-1">
                      <span className="text-[9px] text-slate-400 italic">হিসাব প্রস্তুতকৃত</span>
                    </div>
                    <div className="border-t border-slate-800 pt-1 font-bold text-slate-900">
                      হিসাব ও অর্থ শাখা
                    </div>
                    <div className="text-[8px] text-slate-500 mt-0.5">চূড়ান্ত দেনা-পাওনা</div>
                  </div>

                  {/* 5. Managing Director / Factory Manager */}
                  <div className="flex flex-col justify-end">
                    <div className="h-9 flex items-end justify-center pb-1">
                      <span className="text-[9px] text-slate-400 italic">অনুমোদিত</span>
                    </div>
                    <div className="border-t border-slate-800 pt-1 font-black text-slate-950">
                      কারখানা প্রধান / এমডি
                    </div>
                    <div className="text-[8px] text-slate-500 mt-0.5">চূড়ান্ত সিলমোহর</div>
                  </div>
                </div>
              </div>

              {/* ================= 7. TEAR-OFF RECEIPT SLIP FOR WORKER ================= */}
              <div className="pt-2">
                <div className="border-t-2 border-dashed border-slate-400 pt-1 text-[9px] text-slate-700">
                  <div className="flex items-center justify-between font-bold text-slate-900 mb-0.5">
                    <span className="bg-slate-200 px-1.5 py-0.2 rounded text-[8.5px]">
                      ✂ কর্তন অংশ: পদত্যাগপত্র গ্রহণ ও প্রাপ্তিস্বীকার স্লিপ (শ্রমিকের কপি)
                    </span>
                    <span className="font-mono text-[8.5px] text-slate-600">
                      স্মারক: {refNo}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 bg-slate-50 p-1 rounded border border-slate-200 text-[9px]">
                    <div>
                      শ্রমিকের নাম: <b>{employee.name}</b> | কার্ড নং: <b>{employee.workerId}</b> | পদবি: <b>{employee.designation}</b>
                    </div>
                    <div>
                      জমার তারিখ: <b>{appDateStr}</b>
                    </div>
                    <div className="border-l border-slate-300 pl-2 text-right">
                      গ্রহণকারী কর্মকর্তার স্বাক্ষর: ____________________
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Bottom Control Bar in Modal (No-Print) */}
        <div className="bg-white border-t border-slate-300 p-2.5 sm:px-4 flex items-center justify-between no-print">
          <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>শ্রমিকের নাম, আইডি, পদবি, বেতন ও সব তথ্য স্বয়ংক্রিয়ভাবে সংযুক্ত করা হয়েছে।</span>
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
