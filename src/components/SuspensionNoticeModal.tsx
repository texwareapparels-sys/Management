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
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';

interface SuspensionNoticeModalProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
  onEmployeeUpdated?: (updatedEmp: Employee) => void;
  autoPrint?: boolean;
}

export const SuspensionNoticeModal: React.FC<SuspensionNoticeModalProps> = ({
  employee,
  isOpen,
  onClose,
  showToast,
  onEmployeeUpdated,
  autoPrint = false,
}) => {
  const noticePrintRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Factory settings state
  const [factory, setFactory] = useState<FactorySettings>(DEFAULT_FACTORY_SETTINGS);

  // Customization state for quick inline tweak before print
  const [isEditingForm, setIsEditingForm] = useState(false);
  const [suspensionDate, setSuspensionDate] = useState<string>('');
  const [suspensionDuration, setSuspensionDuration] = useState<string>('');
  const [suspensionReason, setSuspensionReason] = useState<string>('');
  const [memoNo, setMemoNo] = useState<string>('');
  const [showCauseDays, setShowCauseDays] = useState<string>('৩');
  const [subsistenceClause, setSubsistenceClause] = useState<string>(
    'শ্রম আইন ২০০৬ এর ধারা ২৪(২) অনুযায়ী ৫০% খোরপোষ ভাতা প্রদেয়'
  );
  const [inquiryOfficer, setInquiryOfficer] = useState<string>('তদন্ত কর্মকর্তা / অনুসন্ধান কমিটি');
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
      const todayIso = new Date().toISOString().split('T')[0];
      setSuspensionDate(employee.suspensionDate || employee.resignationDate || todayIso);
      setSuspensionDuration(employee.suspensionDuration || '৭ কার্যদিবস (তদন্ত সাপেক্ষে)');
      setSuspensionReason(
        employee.suspensionReason ||
          employee.resignationReason ||
          'শৃঙ্খলাভঙ্গ ও কারখানার নিয়মাবলি লঙ্ঘনের অভিযোগ তদন্তাধীন'
      );
      setMemoNo(`TW/HR-SUS/${employee.workerId || '00'}/${new Date().getFullYear()}`);
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
          suspensionDate: employee.suspensionDate,
          suspensionReason: employee.suspensionReason,
          suspensionDuration: employee.suspensionDuration,
          terminationDate: employee.terminationDate,
          terminationReason: employee.terminationReason,
          terminationMemo: employee.terminationMemo,
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
          suspensionDate: employee.suspensionDate,
          suspensionReason: employee.suspensionReason,
          suspensionDuration: employee.suspensionDuration,
          terminationDate: employee.terminationDate,
          terminationReason: employee.terminationReason,
          terminationMemo: employee.terminationMemo,
        };
        await saveOrUpdateEmployee(payload, employee.id);
        const updated: Employee = { ...employee, signatureUrl: base64 };
        onEmployeeUpdated?.(updated);
        showToast('✓ শ্রমিকের স্বাক্ষর সফলভাবে নোটিশে যুক্ত হয়েছে');
      } catch (err) {
        showToast('স্বাক্ষর সংরক্ষণ করতে সমস্যা হয়েছে');
      }
    };
    reader.readAsDataURL(file);
  };

  // 1-Click Print Handler
  const handlePrint = () => {
    if (noticePrintRef.current && employee) {
      printElement(
        noticePrintRef.current,
        `Suspension_Notice_${employee.workerId || 'Worker'}_${employee.name}`,
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
    if (!noticePrintRef.current || !employee) return;
    setIsDownloadingPDF(true);
    showToast('পিডিএফ তৈরি হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...');

    try {
      const element = noticePrintRef.current;
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
      pdf.save(`Suspension_Notice_${employee.workerId || 'Worker'}_${employee.name}.pdf`);
      showToast('✓ সাময়িক স্থগিতাদেশ নোটিশ PDF সফলভাবে ডাউনলোড হয়েছে');
    } catch (err) {
      console.error('PDF error:', err);
      showToast('PDF তৈরিতে সমস্যা হয়েছে');
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  // 1-Click HD Image Download
  const handleDownloadImage = async () => {
    if (!noticePrintRef.current || !employee) return;
    setIsDownloadingImage(true);
    showToast('HD ছবি তৈরি হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...');

    try {
      const element = noticePrintRef.current;
      const originalWidth = element.style.width;
      const originalMaxWidth = element.style.maxWidth;
      element.style.width = '790px';
      element.style.maxWidth = '790px';

      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 1024,
      });

      element.style.width = originalWidth;
      element.style.maxWidth = originalMaxWidth;

      const link = document.createElement('a');
      link.download = `Suspension_Notice_${employee.workerId || 'Worker'}_${employee.name}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
      showToast('✓ সাময়িক স্থগিতাদেশ নোটিশ ছবি সফলভাবে ডাউনলোড হয়েছে');
    } catch (err) {
      console.error('Image error:', err);
      showToast('ছবি ডাউনলোড করতে সমস্যা হয়েছে');
    } finally {
      setIsDownloadingImage(false);
    }
  };

  if (!isOpen || !employee) return null;

  const suspDateStr = formatDateBn(suspensionDate || employee.suspensionDate || new Date().toISOString().split('T')[0]);
  const joinDateStr = formatDateBn(employee.joinDate || '');

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
          #workerSuspensionNoticeA4Area {
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
            <div className="p-1.5 rounded-lg bg-amber-600/30 text-amber-400 border border-amber-500/40">
              <AlertTriangle className="w-5 h-5 shrink-0" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black flex items-center gap-1.5">
                <span>সাময়িক স্থগিতাদেশ / বরখাস্ত নোটিশ (১-ক্লিক প্রিন্ট)</span>
                <span className="text-[10px] bg-amber-600 text-white px-1.5 py-0.2 rounded font-bold">
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
              title="শ্রমিকের ছবি পরিবর্তন বা সংযুক্ত করুন"
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
                  ? 'bg-amber-600 text-white border-amber-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700'
              }`}
              title="স্থগিতাদেশের তথ্য দ্রুত কাস্টমাইজ করুন"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">তথ্য সম্পাদন</span>
            </button>

            <button
              type="button"
              disabled={isDownloadingPDF}
              onClick={handleDownloadPDF}
              className="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
              title="স্থগিতাদেশ নোটিশ PDF ডাউনলোড করুন"
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
          <div className="bg-amber-50 border-b border-amber-200 p-3 sm:px-5 text-xs text-amber-950 space-y-2 no-print shrink-0 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-amber-700" />
                <span>প্রিন্ট করার পূর্বে স্থগিতাদেশের তথ্য দ্রুত পরিবর্তন বা সম্পাদন:</span>
              </span>
              <button
                type="button"
                onClick={() => setIsEditingForm(false)}
                className="text-amber-800 hover:text-amber-950 font-bold"
              >
                ✕ বন্ধ
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">স্মারক নং (Memo No)</label>
                <input
                  type="text"
                  value={memoNo}
                  onChange={(e) => setMemoNo(e.target.value)}
                  className="w-full p-1.5 bg-white border border-amber-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">স্থগিতের কার্যকর তারিখ</label>
                <input
                  type="date"
                  value={suspensionDate}
                  onChange={(e) => setSuspensionDate(e.target.value)}
                  className="w-full p-1.5 bg-white border border-amber-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">স্থগিতের মেয়াদ</label>
                <input
                  type="text"
                  value={suspensionDuration}
                  onChange={(e) => setSuspensionDuration(e.target.value)}
                  placeholder="যেমন: ৭ কার্যদিবস / তদন্ত শেষ না হওয়া পর্যন্ত"
                  className="w-full p-1.5 bg-white border border-amber-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">জবাব দেওয়ার সময় (দিন)</label>
                <input
                  type="text"
                  value={showCauseDays}
                  onChange={(e) => setShowCauseDays(e.target.value)}
                  placeholder="যেমন: ৩"
                  className="w-full p-1.5 bg-white border border-amber-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">স্থগিতের সুনির্দিষ্ট অভিযোগ / কারণ</label>
                <input
                  type="text"
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  placeholder="যেমন: কারখানা কর্তৃপক্ষের বিনা অনুমতিতে কর্মবিরতি ও বিশৃঙ্খলা"
                  className="w-full p-1.5 bg-white border border-amber-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">খোরপোষ ভাতা সংক্রান্ত ধারা</label>
                <input
                  type="text"
                  value={subsistenceClause}
                  onChange={(e) => setSubsistenceClause(e.target.value)}
                  className="w-full p-1.5 bg-white border border-amber-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-amber-200">
              <div className="text-[11px] text-slate-600">
                💡 এখানে যেকোনো তথ্য পরিবর্তন করলে সরাসরি নিচের প্রিন্ট প্রিভিউতে আপডেট হবে।
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsEditingForm(false);
                  showToast('নোটিশের তথ্য আপডেট হয়েছে');
                }}
                className="py-1 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs cursor-pointer"
              >
                সম্পন্ন
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Container with Printable A4 Page */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-5 bg-slate-200/90 flex justify-center">
          
          {/* ======================================================== */}
          {/* THE OFFICIAL SINGLE-PAGE A4 SUSPENSION NOTICE            */}
          {/* Strictly structured for 1-page standard A4 print/export   */}
          {/* ======================================================== */}
          <div
            id="workerSuspensionNoticeA4Area"
            ref={noticePrintRef}
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
                <div className="text-lg mt-1 tracking-normal font-bold">সাময়িক স্থগিতাদেশ নোটিশ</div>
              </div>
            </div>

            <div className="relative z-10 space-y-2">
              
              {/* ================= 1. OFFICIAL FACTORY LETTERHEAD ================= */}
              <div className="border-b-2 border-slate-900 pb-2">
                <div className="flex items-start justify-between gap-3">
                  
                  {/* WORKER PASSPORT PHOTO (TOP-LEFT CORNER) */}
                  <div className="shrink-0 flex flex-col items-center">
                    <div className="w-[82px] h-[98px] border-2 border-slate-800 bg-slate-50 rounded p-0.5 shadow-xs flex flex-col items-center justify-center relative overflow-hidden">
                      {safePhotoUrl ? (
                        <img
                          src={safePhotoUrl}
                          alt={employee.name}
                          crossOrigin="anonymous"
                          className="w-full h-full object-cover rounded-xs"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-100 p-1 text-center">
                          <Camera className="w-6 h-6 mb-1 text-slate-400" />
                          <span className="text-[9px] font-bold leading-tight">শ্রমিকের পাসপোর্ট ছবি</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] font-bold text-slate-600 mt-0.5 tracking-tight">
                      আইডি: {employee.workerId}
                    </span>
                  </div>

                  {/* FACTORY CENTER TITLE */}
                  <div className="flex-1 text-center px-1">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-snug">
                      {factory.name || 'টেক্স ওয়ার অ্যাপারেলস লিমিটেড'}
                    </h1>
                    {factory.nameEn && (
                      <p className="text-[12px] font-extrabold text-slate-700 tracking-wider uppercase font-sans">
                        {factory.nameEn}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-600 mt-0.5 flex items-center justify-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 inline text-slate-500" />
                        {factory.address || 'প্লট নং ১২, রোড নং ০৪, কোনাবাড়ী বিসিক, গাজীপুর, বাংলাদেশ'}
                      </span>
                      {factory.phone && (
                        <span className="flex items-center gap-1 font-sans">
                          <Phone className="w-3 h-3 inline text-slate-500" />
                          ফোন: {factory.phone}
                        </span>
                      )}
                    </p>
                    <p className="text-[9.5px] font-semibold text-slate-500 mt-0.5">
                      {factory.email ? `ইমেইল: ${factory.email} • ` : ''}প্রশাসন ও মানবসম্পদ বিভাগ (HR & Administration Dept.)
                    </p>
                  </div>

                  {/* OFFICIAL NOTICE STAMP / SEAL BOX (TOP-RIGHT CORNER) */}
                  <div className="shrink-0 flex flex-col items-center">
                    <div className="w-[82px] h-[98px] border-2 border-dashed border-amber-600 bg-amber-50/50 rounded p-1 flex flex-col items-center justify-center text-center">
                      <ShieldAlert className="w-6 h-6 text-amber-700 mb-1" />
                      <span className="text-[8.5px] font-bold text-amber-900 leading-tight">
                        অফিসিয়াল আদেশ
                      </span>
                      <span className="text-[7.5px] text-amber-800 mt-0.5 font-sans font-bold">
                        গোপনীয় ও জরুরি
                      </span>
                    </div>
                    <span className="text-[8.5px] font-bold text-amber-800 mt-0.5">
                      শ্রম আইন ২৪ ধারা
                    </span>
                  </div>
                </div>
              </div>

              {/* ================= 2. MEMO NO, DATE & BANNER ================= */}
              <div className="flex items-center justify-between text-[11px] pt-1 font-semibold text-slate-800 border-b border-slate-200 pb-1.5">
                <div className="flex items-center gap-1">
                  <span className="text-slate-600">স্মারক নং:</span>
                  <span className="font-mono font-bold text-slate-900">{memoNo}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-600">ইস্যুর তারিখ:</span>
                  <span className="font-bold text-slate-900">{suspDateStr} খ্রিষ্টাব্দ</span>
                </div>
              </div>

              {/* NOTICE BANNER HEADING */}
              <div className="text-center py-1 bg-amber-600 text-white rounded-md shadow-xs">
                <h2 className="text-sm sm:text-base font-black tracking-wide">
                  সাময়িক বরখাস্ত / স্থগিতাদেশ ও কারণ দর্শানোর নোটিশ
                </h2>
                <p className="text-[9.5px] font-medium text-amber-100">
                  (বাংলাদেশ শ্রম আইন ২০০৬ এর ধারা ২৪ মোতাবেক শৃঙ্খলাভঙ্গ সংক্রান্ত তদন্ত সাপেক্ষে আদেশ)
                </p>
              </div>

              {/* ================= 3. EMPLOYEE PARTICULARS TABLE ================= */}
              <div className="border border-slate-700 rounded overflow-hidden text-[10.5px]">
                <div className="bg-slate-800 text-white font-bold px-2 py-0.5 text-[10px] flex items-center justify-between">
                  <span>অভিযুক্ত শ্রমিকের পূর্ণ বিবরণ ও পরিচিতি</span>
                  <span className="font-mono text-amber-300">কার্ড: {employee.workerId}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-slate-300 bg-white">
                  <div className="p-1.5">
                    <span className="text-slate-500 block text-[9.5px]">শ্রমিকের পূর্ণ নাম:</span>
                    <span className="font-bold text-slate-900">{employee.name}</span>
                  </div>

                  <div className="p-1.5">
                    <span className="text-slate-500 block text-[9.5px]">কর্মী আইডি / কার্ড নং:</span>
                    <span className="font-bold text-slate-900 font-mono">{employee.workerId}</span>
                  </div>

                  <div className="p-1.5">
                    <span className="text-slate-500 block text-[9.5px]">পদবি (Designation):</span>
                    <span className="font-bold text-slate-900">{employee.designation || 'অপারেটর'}</span>
                  </div>

                  <div className="p-1.5">
                    <span className="text-slate-500 block text-[9.5px]">শাখা / সেকশন:</span>
                    <span className="font-bold text-slate-900">{employee.department || 'সুইং সেকশন'}</span>
                  </div>

                  <div className="p-1.5">
                    <span className="text-slate-500 block text-[9.5px]">যোগদানের তারিখ:</span>
                    <span className="font-bold text-slate-900">{joinDateStr || 'উল্লেখ নেই'}</span>
                  </div>

                  <div className="p-1.5">
                    <span className="text-slate-500 block text-[9.5px]">মূল মাসিক বেতন:</span>
                    <span className="font-bold text-slate-900">{formatMoney(employee.salary)} টাকা</span>
                  </div>

                  <div className="p-1.5">
                    <span className="text-slate-500 block text-[9.5px]">জাতীয় পরিচয়পত্র (NID):</span>
                    <span className="font-bold text-slate-900 font-mono">{employee.nid || 'রেকর্ডভুক্ত'}</span>
                  </div>

                  <div className="p-1.5">
                    <span className="text-slate-500 block text-[9.5px]">যোগাযোগের মোবাইল নং:</span>
                    <span className="font-bold text-slate-900 font-mono">{employee.mobile || 'রেকর্ডভুক্ত'}</span>
                  </div>

                  <div className="p-1.5 sm:col-span-4 bg-slate-50/70">
                    <span className="text-slate-500 inline text-[9.5px]">বর্তমান ও স্থায়ী ঠিকানা: </span>
                    <span className="font-medium text-slate-800">
                      {employee.address || 'কারখানা সংলগ্ন কর্মী রেকর্ডপত্র অনুযায়ী সংরক্ষিত'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ================= 4. FORMAL NOTICE BODY ================= */}
              <div className="text-[10.5px] leading-relaxed text-slate-800 space-y-2 text-justify">
                <div>
                  <span className="font-bold">বরাবর,</span><br />
                  <span>জনাব / মোছাঃ </span>
                  <span className="font-bold text-slate-950 underline underline-offset-2">{employee.name}</span>,{' '}
                  <span>পদবি: <b>{employee.designation}</b>, কার্ড নং: <b>{employee.workerId}</b>, {factory.name}।</span>
                </div>

                <div className="bg-slate-100 p-1.5 rounded border border-slate-300 font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="text-amber-800">বিষয়:</span>
                  <span>শৃঙ্খলাভঙ্গ সংক্রান্ত অভিযোগ তদন্ত সাপেক্ষে সাময়িক বরখাস্ত ও কারণ দর্শানোর নোটিশ।</span>
                </div>

                <p>
                  আপনার অবগতির জন্য জানানো যাচ্ছে যে, কারখানার কর্মপরিবেশ ও বিধিমালা পরিপন্থী নিম্নবর্ণিত গুরুতর অভিযোগ আপনার বিরুদ্ধে আনীত হয়েছে:
                </p>

                {/* SPECIFIC SUSPENSION REASON / ALLEGATION HIGHLIGHT BOX */}
                <div className="p-2 rounded bg-amber-50 border-l-4 border-amber-600 text-amber-950 text-[10.5px] space-y-1">
                  <div className="flex items-start gap-1.5">
                    <span className="font-bold text-amber-900 shrink-0">অভিযোগ / কারণ:</span>
                    <span className="font-semibold">{suspensionReason}</span>
                  </div>
                  <div className="flex items-center gap-3 pt-0.5 text-[10px] text-amber-900 flex-wrap">
                    <span>• <b>কার্যকর তারিখ:</b> {suspDateStr}</span>
                    <span>• <b>স্থগিতের মেয়াদকাল:</b> {suspensionDuration}</span>
                    <span>• <b>ধারা:</b> বাংলাদেশ শ্রম আইন ২০০৬ এর ধারা ২৪</span>
                  </div>
                </div>

                {/* LEGAL CLAUSES & INSTRUCTIONS */}
                <div className="space-y-1.5 text-[10px] text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                  <p className="font-bold text-slate-900 underline">বিশেষ আদেশ ও নির্দেশনাসমূহ:</p>
                  <ol className="list-decimal pl-4 space-y-0.5">
                    <li>
                      <b>সাময়িক স্থগিতাদেশ:</b> উপরোক্ত অভিযোগের প্রেক্ষিতে নিরপেক্ষ অভ্যন্তরীণ তদন্ত সম্পন্ন না হওয়া পর্যন্ত আপনাকে অত্র কারখানার দায়িত্ব ও কর্মপরিধি হতে সাময়িকভাবে বরখাস্ত (Suspended) রাখা হলো।
                    </li>
                    <li>
                      <b>খোরপোষ ভাতা (Subsistence Allowance):</b> সাময়িক বরখাস্তকালীন আপনি <b>{subsistenceClause}</b> প্রাপ্য হইবেন।
                    </li>
                    <li>
                      <b>কারণ দর্শানোর নির্দেশ:</b> অত্র নোটিশ জারির আগামী <b>{toBengaliNumber(showCauseDays)} ({showCauseDays}) কার্যদিবসের মধ্যে</b> আনীত অভিযোগের প্রেক্ষিতে আপনার কোনো আত্মপক্ষ সমর্থনের ব্যাখ্যা থাকলে তা লিখিত আকারে নিম্নস্বাক্ষরকারীর দপ্তরে দাখিলের নির্দেশ দেওয়া হলো।
                    </li>
                    <li>
                      <b>কারখানা প্রাঙ্গণে উপস্থিতি:</b> তদন্ত চলাকালীন কর্তৃপক্ষের পূর্বানুমতি ছাড়া কারখানা প্রাঙ্গণে বা কর্মস্থলে প্রবেশ সম্পূর্ণ নিষিদ্ধ থাকিবে, তবে তদন্ত কমিটি তলব করিলে উপস্থিত থাকতে বাধ্য থাকিবেন।
                    </li>
                  </ol>
                </div>
              </div>

              {/* ================= 5. OFFICIAL SIGNATURES & STAMPS ================= */}
              <div className="pt-4 border-t-2 border-slate-900 mt-2">
                <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                  
                  {/* SIGNATURE 1: WORKER */}
                  <div className="flex flex-col justify-end">
                    <div className="h-9 flex items-end justify-center pb-1">
                      {safeSignatureUrl || employee.signatureUrl ? (
                        <img
                          src={safeSignatureUrl || employee.signatureUrl}
                          alt="শ্রমিকের স্বাক্ষর"
                          className="max-h-8 max-w-[110px] object-contain"
                        />
                      ) : (
                        <span className="text-[9px] text-slate-400 italic">..................................</span>
                      )}
                    </div>
                    <div className="border-t border-slate-700 pt-0.5 font-bold text-slate-900">
                      শ্রমিকের স্বাক্ষর ও তারিখ
                    </div>
                    <span className="text-[8px] text-slate-500">(নোটিশ প্রাপ্তি স্বীকার)</span>
                  </div>

                  {/* SIGNATURE 2: INQUIRY OFFICER / SUPERVISOR */}
                  <div className="flex flex-col justify-end">
                    <div className="h-9 flex items-end justify-center pb-1">
                      <span className="text-[9px] text-slate-400 italic">..................................</span>
                    </div>
                    <div className="border-t border-slate-700 pt-0.5 font-bold text-slate-900">
                      {inquiryOfficer}
                    </div>
                    <span className="text-[8px] text-slate-500">(তদন্ত সংশ্লিষ্ট শাখা)</span>
                  </div>

                  {/* SIGNATURE 3: HR & ADMIN MANAGER */}
                  <div className="flex flex-col justify-end">
                    <div className="h-9 flex items-end justify-center pb-1">
                      <span className="text-[9px] text-slate-400 italic">..................................</span>
                    </div>
                    <div className="border-t border-slate-700 pt-0.5 font-bold text-slate-900">
                      এইচআর ও প্রশাসন কর্মকর্তা
                    </div>
                    <span className="text-[8px] text-slate-500">{factory.name}</span>
                  </div>

                  {/* SIGNATURE 4: FACTORY AUTHORITY / MD */}
                  <div className="flex flex-col justify-end">
                    <div className="h-9 flex items-end justify-center pb-1">
                      <span className="text-[9px] text-slate-400 italic">..................................</span>
                    </div>
                    <div className="border-t border-slate-700 pt-0.5 font-bold text-slate-900">
                      অনুমোদনকারী কর্তৃপক্ষ
                    </div>
                    <span className="text-[8px] text-slate-500">ব্যবস্থাপনা পরিচালক / জিএম</span>
                  </div>
                </div>

                {/* FOOTER BAR */}
                <div className="mt-2.5 pt-1 border-t border-slate-200 flex items-center justify-between text-[8px] text-slate-500">
                  <span>TexWare Apparels HR Management System • ফরম নং: TW-HR-SUS-04</span>
                  <span>কম্পিউটার জেনারেটেড অফিসিয়াল নোটিশ • কপি: ১. কর্মী নথি, ২. শ্রমিক, ৩. এইচআর ও শ্রম শাখা</span>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
