import React, { useState, useEffect, useRef } from 'react';
import { Employee, FactorySettings } from '../types';
import { formatMoney, formatDateBn, toBengaliNumber } from '../lib/utils';
import { printElement } from '../lib/printer';
import {
  saveOrUpdateEmployee,
  loadFactorySettings,
  saveFactorySettings,
  DEFAULT_FACTORY_SETTINGS,
  DEFAULT_CONTRACT_RULES,
  DEFAULT_CONTRACT_DECLARATION
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
  CreditCard,
  FileText,
  Save,
  RotateCcw,
  Download,
  FileDown,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  Eye,
  Maximize2
} from 'lucide-react';

interface ContractLetterModalProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  onEmployeeUpdated?: (updatedEmp: Employee) => void;
  showToast: (msg: string) => void;
}

export const ContractLetterModal: React.FC<ContractLetterModalProps> = ({
  employee,
  isOpen,
  onClose,
  onEmployeeUpdated,
  showToast,
}) => {
  const contractPrintRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Factory settings state (Loaded from Firebase/localStorage)
  const [factory, setFactory] = useState<FactorySettings>(DEFAULT_FACTORY_SETTINGS);
  const [isEditingFactory, setIsEditingFactory] = useState(false);
  const [factoryName, setFactoryName] = useState(DEFAULT_FACTORY_SETTINGS.name);
  const [factoryNameEn, setFactoryNameEn] = useState(DEFAULT_FACTORY_SETTINGS.nameEn || '');
  const [factoryAddress, setFactoryAddress] = useState(DEFAULT_FACTORY_SETTINGS.address);
  const [factoryPhone, setFactoryPhone] = useState(DEFAULT_FACTORY_SETTINGS.phone);
  const [factoryEmail, setFactoryEmail] = useState(DEFAULT_FACTORY_SETTINGS.email || '');
  const [contractRules, setContractRules] = useState<string[]>(DEFAULT_CONTRACT_RULES);
  const [contractDeclaration, setContractDeclaration] = useState<string>(DEFAULT_CONTRACT_DECLARATION);
  const [newRuleInput, setNewRuleInput] = useState('');
  const [isSavingFactory, setIsSavingFactory] = useState(false);

  // Editable bank info state inside modal
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [isSavingBank, setIsSavingBank] = useState(false);

  // Download & Export loading states
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [safePhotoUrl, setSafePhotoUrl] = useState<string | undefined>(employee?.photoUrl);
  const [safeSignatureUrl, setSafeSignatureUrl] = useState<string | undefined>(employee?.signatureUrl);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Safely pre-convert external photoUrl to base64 data URL to prevent canvas tainting
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
            // Tainted or blocked by host CORS
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

  // Safely pre-convert external signatureUrl to base64 data URL for canvas rendering
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

  // Load Factory Settings on modal open
  useEffect(() => {
    if (isOpen) {
      loadFactorySettings().then((settings) => {
        setFactory(settings);
        setFactoryName(settings.name);
        setFactoryNameEn(settings.nameEn || '');
        setFactoryAddress(settings.address);
        setFactoryPhone(settings.phone);
        setFactoryEmail(settings.email || '');
        const rules = Array.isArray(settings.contractRules) && settings.contractRules.length > 0
          ? settings.contractRules
          : DEFAULT_CONTRACT_RULES;
        setContractRules(rules);
        setContractDeclaration(settings.contractDeclaration || DEFAULT_CONTRACT_DECLARATION);
      });
    }
  }, [isOpen]);

  if (!isOpen || !employee) return null;

  // Add rule in modal drawer
  const handleAddModalRule = () => {
    if (!newRuleInput.trim()) {
      showToast('শর্ত বা নিয়মের বিবরণ লিখুন');
      return;
    }
    setContractRules((prev) => [...prev, newRuleInput.trim()]);
    setNewRuleInput('');
  };

  const handleUpdateModalRule = (idx: number, val: string) => {
    setContractRules((prev) => {
      const updated = [...prev];
      updated[idx] = val;
      return updated;
    });
  };

  const handleDeleteModalRule = (idx: number) => {
    if (contractRules.length <= 1) {
      showToast('চুক্তিপত্রে অন্তত ১টি শর্ত থাকা আবশ্যক');
      return;
    }
    setContractRules((prev) => prev.filter((_, i) => i !== idx));
  };

  // Handle Photo Upload directly from device
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('অনুগ্রহ করে সঠিক ছবির ফাইল (JPG/PNG) নির্বাচন করুন');
      return;
    }

    if (file.size > 2.5 * 1024 * 1024) {
      showToast('ছবির সাইজ ২.৫ মেগাবাইটের কম হতে হবে');
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

  // Handle Worker Signature Upload from modal
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
        showToast('✓ শ্রমিকের স্বাক্ষর সফলভাবে চুক্তিপত্রে যুক্ত হয়েছে');
      } catch (err) {
        showToast('স্বাক্ষর সংরক্ষণ করতে সমস্যা হয়েছে');
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Remove Worker Signature
  const handleRemoveSignature = async () => {
    if (!employee) return;
    if (!window.confirm('আপনি কি এই চুক্তিপত্র থেকে শ্রমিকের স্বাক্ষর মুছে ফেলতে চান?')) return;
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
        signatureUrl: '',
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
      const updated: Employee = { ...employee, signatureUrl: '' };
      onEmployeeUpdated?.(updated);
      setSafeSignatureUrl(undefined);
      showToast('✓ শ্রমিকের স্বাক্ষর মুছে ফেলা হয়েছে');
    } catch {
      showToast('স্বাক্ষর মুছতে সমস্যা হয়েছে');
    }
  };

  // Handle Save Factory Information
  const handleSaveFactorySettings = async () => {
    setIsSavingFactory(true);
    try {
      const activeRules = contractRules.map((r) => r.trim()).filter((r) => r.length > 0);
      const finalRules = activeRules.length > 0 ? activeRules : DEFAULT_CONTRACT_RULES;
      const updated: FactorySettings = {
        name: factoryName.trim() || DEFAULT_FACTORY_SETTINGS.name,
        nameEn: factoryNameEn.trim() || DEFAULT_FACTORY_SETTINGS.nameEn,
        address: factoryAddress.trim() || DEFAULT_FACTORY_SETTINGS.address,
        phone: factoryPhone.trim() || DEFAULT_FACTORY_SETTINGS.phone,
        email: factoryEmail.trim() || DEFAULT_FACTORY_SETTINGS.email,
        contractRules: finalRules,
        contractDeclaration: contractDeclaration.trim() || DEFAULT_CONTRACT_DECLARATION,
        updatedAt: Date.now(),
      };
      await saveFactorySettings(updated);
      setFactory(updated);
      setContractRules(finalRules);
      setIsEditingFactory(false);
      showToast('✓ কারখানার নাম, ঠিকানা ও চুক্তিপত্রের সকল শর্তাবলি সফলভাবে সংরক্ষিত হয়েছে');
    } catch (e) {
      showToast('কারখানার তথ্য সংরক্ষণ করা যায়নি');
    } finally {
      setIsSavingFactory(false);
    }
  };

  // Handle Save Bank details
  const handleSaveBankInfo = async () => {
    setIsSavingBank(true);
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
        signatureUrl: employee.signatureUrl,
        bankName: bankName.trim(),
        accountName: accountName.trim() || employee.name,
        accountNumber: accountNumber.trim(),
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
      const updated: Employee = {
        ...employee,
        bankName: bankName.trim(),
        accountName: accountName.trim() || employee.name,
        accountNumber: accountNumber.trim(),
      };
      onEmployeeUpdated?.(updated);
      setIsEditingBank(false);
      showToast('✓ ব্যাংক তথ্য সফলভাবে সংরক্ষিত হয়েছে');
    } catch (e) {
      showToast('ব্যাংক তথ্য সংরক্ষণ করা যায়নি');
    } finally {
      setIsSavingBank(false);
    }
  };

  // Robust contract canvas renderer with Tailwind v4 oklch color sanitization & CORS protection
  const generateContractCanvas = async (scale = 2) => {
    if (!contractPrintRef.current) throw new Error('Contract element not found');

    return await html2canvas(contractPrintRef.current, {
      scale,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      windowWidth: 1200,
      onclone: (clonedDoc) => {
        // 1. Convert modern Tailwind v4 oklch / lab / color() functions to RGB/HEX
        const tempCanvas = clonedDoc.createElement('canvas');
        tempCanvas.width = 1;
        tempCanvas.height = 1;
        const tempCtx = tempCanvas.getContext('2d');
        const colorCache = new Map<string, string>();

        const toRgb = (colorVal: string): string => {
          if (!colorVal || typeof colorVal !== 'string') return colorVal;
          if (!colorVal.includes('oklch') && !colorVal.includes('lab') && !colorVal.includes('color(')) {
            return colorVal;
          }
          if (colorCache.has(colorVal)) return colorCache.get(colorVal)!;
          if (tempCtx) {
            tempCtx.fillStyle = '#ffffff';
            tempCtx.fillStyle = colorVal;
            const resolved = tempCtx.fillStyle;
            colorCache.set(colorVal, resolved);
            return resolved;
          }
          return '#0f172a';
        };

        // Remove all .no-print elements in cloned document
        const noPrintElements = clonedDoc.querySelectorAll('.no-print');
        noPrintElements.forEach((el) => el.remove());

        const allElements = clonedDoc.querySelectorAll('#workerContractLetterA4Area, #workerContractLetterA4Area *');
        allElements.forEach((el) => {
          if (el instanceof HTMLElement) {
            const cs = window.getComputedStyle(el);
            const bg = cs.backgroundColor;
            const col = cs.color;
            const border = cs.borderColor;
            if (bg && (bg.includes('oklch') || bg.includes('color(') || bg.includes('lab'))) {
              el.style.backgroundColor = toRgb(bg);
            }
            if (col && (col.includes('oklch') || col.includes('color(') || col.includes('lab'))) {
              el.style.color = toRgb(col);
            }
            if (border && (border.includes('oklch') || border.includes('color(') || border.includes('lab'))) {
              el.style.borderColor = toRgb(border);
            }
          }
        });

        // 2. Ensure images in cloned doc are safe and won't taint canvas
        const clonedImgs = clonedDoc.querySelectorAll('#workerContractLetterA4Area img');
        clonedImgs.forEach((imgEl) => {
          if (imgEl instanceof HTMLImageElement) {
            imgEl.crossOrigin = 'anonymous';
            if (safePhotoUrl && safePhotoUrl.startsWith('data:')) {
              imgEl.src = safePhotoUrl;
            }
          }
        });

        // 3. Ensure the cloned container has visible styling and zero margin
        const clonedArea = clonedDoc.getElementById('workerContractLetterA4Area');
        if (clonedArea) {
          clonedArea.style.boxShadow = 'none';
          clonedArea.style.border = '1px solid #94a3b8';
          clonedArea.style.backgroundColor = '#ffffff';
          clonedArea.style.color = '#0f172a';
          clonedArea.style.margin = '0 auto';
        }
      },
    });
  };

  const handleDownloadPDF = async () => {
    if (!contractPrintRef.current || !employee) return;
    try {
      setIsDownloadingPDF(true);
      showToast('A4 চুক্তিপত্র PDF তৈরি হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...');

      const canvas = await generateContractCanvas(2);
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 4;
      const printableWidth = pageWidth - margin * 2;
      const printableHeight = pageHeight - margin * 2;

      // Fit to single A4 page
      const imgWidth = printableWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let finalWidth = imgWidth;
      let finalHeight = imgHeight;

      if (finalHeight > printableHeight) {
        finalHeight = printableHeight;
        finalWidth = (canvas.width * finalHeight) / canvas.height;
      }

      const xOffset = (pageWidth - finalWidth) / 2;
      const yOffset = margin;

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight, undefined, 'FAST');
      const safeName = (employee.name || 'Worker').replace(/[\s/\\?%*:|"<>]+/g, '_');
      const fileName = `Contract_Letter_${employee.workerId || 'Worker'}_${safeName}.pdf`;

      // Download using blob URL for maximum browser compatibility (including iframe sandbox)
      try {
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 1500);
      } catch (blobErr) {
        pdf.save(fileName);
      }

      showToast('✓ চুক্তিপত্র PDF সফলভাবে ডাউনলোড হয়েছে');
    } catch (err) {
      console.error('PDF error:', err);
      showToast('সরাসরি PDF ডাউনলোড ব্যর্থ হয়েছে, প্রিন্ট ডায়ালগ থেকে "Save as PDF" করুন');
      handlePrintContract();
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!contractPrintRef.current || !employee) return;
    try {
      setIsDownloadingImage(true);
      showToast('চুক্তিপত্রের HD ছবি তৈরি হচ্ছে...');

      const canvas = await generateContractCanvas(2.2);
      const safeName = (employee.name || 'Worker').replace(/[\s/\\?%*:|"<>]+/g, '_');
      const fileName = `Contract_Letter_${employee.workerId || 'Worker'}_${safeName}.png`;

      // Download image using blob URL
      canvas.toBlob((blob) => {
        if (!blob) {
          const link = document.createElement('a');
          link.download = fileName;
          link.href = canvas.toDataURL('image/png');
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          showToast('✓ চুক্তিপত্রের HD ছবি সফলভাবে ডাউনলোড হয়েছে');
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = fileName;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 1500);
        showToast('✓ চুক্তিপত্রের HD ছবি সফলভাবে ডাউনলোড হয়েছে');
      }, 'image/png');
    } catch (err) {
      console.error('Image error:', err);
      showToast('ছবি ডাউনলোড করতে সমস্যা হয়েছে');
    } finally {
      setIsDownloadingImage(false);
    }
  };

  const handlePrintContract = () => {
    if (contractPrintRef.current && employee) {
      printElement(
        contractPrintRef.current,
        `Contract_Letter_${employee.workerId || 'Worker'}_${employee.name}`,
        'contract'
      );
    } else {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto contract-modal-backdrop print:bg-white print:p-0 print:m-0 print:static print:overflow-visible">
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
          #workerContractLetterA4Area {
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
        <div className="bg-slate-900 text-white p-2.5 sm:px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shrink-0 shadow-sm no-print">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xs sm:text-sm font-black flex items-center gap-1.5">
                  <span>শ্রমিক নিয়োগ চুক্তিপত্র</span>
                </h2>
                <span className="text-[10px] bg-blue-600/80 text-white px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  <span>A4 লাইভ প্রিভিউ</span>
                </span>
                <span className="text-[10px] bg-emerald-600/80 text-white px-1.5 py-0.5 rounded font-bold">
                  একক পাতা নিশ্চিত
                </span>
              </div>
              <p className="text-[10.5px] text-slate-300 mt-0.5">
                {employee.name} — ID: {employee.workerId} ({employee.designation})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* Zoom / Scale Controls for Contract Preview */}
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.6, Math.round((z - 0.1) * 10) / 10))}
                className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                title="প্রিভিউ ছোট করুন (Zoom Out)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 font-mono text-[10px] font-bold text-amber-400 min-w-[38px] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(1.4, Math.round((z + 0.1) * 10) / 10))}
                className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                title="প্রিভিউ বড় করুন (Zoom In)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                className="px-1.5 py-0.5 rounded hover:bg-slate-700 text-[10px] font-bold text-slate-300 hover:text-white cursor-pointer"
                title="১০০% স্বাভাবিক মাপে দেখুন"
              >
                ১০০%
              </button>
            </div>

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
              title="শ্রমিকের ছবি নির্বাচন করুন"
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
              className="py-1 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
              title="শ্রমিকের কাগজের সইয়ের ছবি বা ডিজিটাল স্বাক্ষর আপলোড করুন"
            >
              <Upload className="w-3.5 h-3.5 text-white" />
              <span>{employee.signatureUrl ? 'স্বাক্ষর ছবি পরিবর্তন' : 'স্বাক্ষরের ছবি আপলোড'}</span>
            </button>

            {employee.signatureUrl && (
              <button
                type="button"
                onClick={handleRemoveSignature}
                className="py-1 px-2 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-400 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer border border-slate-700"
                title="চুক্তিপত্র থেকে স্বাক্ষর মুছে ফেলুন"
              >
                <Trash2 className="w-3 h-3" />
                <span className="hidden md:inline">স্বাক্ষর মুছুন</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIsEditingFactory(!isEditingFactory);
                setIsEditingBank(false);
              }}
              className={`py-1 px-2.5 rounded-lg font-bold text-[11px] flex items-center gap-1 transition cursor-pointer border ${
                isEditingFactory
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700'
              }`}
              title="কারখানার নাম, ঠিকানা ও ফোন নম্বর পরিবর্তন"
            >
              <Building2 className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">কারখানা তথ্য</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setBankName(employee.bankName || 'ডাচ বাংলা ব্যাংক (রকেট)');
                setAccountName(employee.accountName || employee.name);
                setAccountNumber(employee.accountNumber || '');
                setIsEditingBank(!isEditingBank);
                setIsEditingFactory(false);
              }}
              className={`py-1 px-2.5 rounded-lg font-bold text-[11px] flex items-center gap-1 transition cursor-pointer border ${
                isEditingBank
                  ? 'bg-amber-600 text-white border-amber-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700'
              }`}
              title="ব্যাংক তথ্য হালনাগাদ করুন"
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">ব্যাংক তথ্য</span>
            </button>

            <button
              type="button"
              disabled={isDownloadingPDF}
              onClick={handleDownloadPDF}
              className="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
              title="A4 চুক্তিপত্র PDF ডাউনলোড করুন"
            >
              {isDownloadingPDF ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-white" />
              )}
              <span className="hidden sm:inline">PDF</span>
            </button>

            {/* DIRECT A4 PRINT BUTTON */}
            <button
              type="button"
              onClick={handlePrintContract}
              className="py-1 px-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md active:scale-95"
              title="১-ক্লিকে A4 সাইজ চুক্তিপত্র প্রিন্ট করুন"
            >
              <Printer className="w-4 h-4 stroke-[2.5]" />
              <span>A4 প্রিন্ট</span>
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

        {/* Factory Info Inline Drawer (No-Print) */}
        {isEditingFactory && (
          <div className="bg-blue-50 border-b border-blue-200 p-3 sm:px-5 text-xs text-blue-950 space-y-2 no-print shrink-0 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-700" />
                <span>কারখানার নাম, ঠিকানা ও যোগাযোগের ফোন নম্বর সম্পাদনা করুন:</span>
              </span>
              <button
                type="button"
                onClick={() => setIsEditingFactory(false)}
                className="text-blue-800 hover:text-blue-950 font-bold"
              >
                ✕ বন্ধ
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">কারখানার নাম (বাংলা)</label>
                <input
                  type="text"
                  value={factoryName}
                  onChange={(e) => setFactoryName(e.target.value)}
                  placeholder="যেমন: টেক্স ওয়ার অ্যাপারেলস"
                  className="w-full p-1.5 bg-white border border-blue-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">কারখানার নাম (English)</label>
                <input
                  type="text"
                  value={factoryNameEn}
                  onChange={(e) => setFactoryNameEn(e.target.value)}
                  placeholder="e.g. TexWare Apparels Ltd."
                  className="w-full p-1.5 bg-white border border-blue-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">কারখানার ফোন নম্বর</label>
                <input
                  type="text"
                  value={factoryPhone}
                  onChange={(e) => setFactoryPhone(e.target.value)}
                  placeholder="+৮৮০১৭১২-৩৪৫৬৭৮"
                  className="w-full p-1.5 bg-white border border-blue-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">ইমেইল অ্যাড্রেস</label>
                <input
                  type="text"
                  value={factoryEmail}
                  onChange={(e) => setFactoryEmail(e.target.value)}
                  placeholder="info@texwareapparels.com"
                  className="w-full p-1.5 bg-white border border-blue-300 rounded-lg text-xs"
                />
              </div>
              <div className="sm:col-span-2 md:col-span-4">
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">কারখানার পূর্ণাঙ্গ ঠিকানা</label>
                <input
                  type="text"
                  value={factoryAddress}
                  onChange={(e) => setFactoryAddress(e.target.value)}
                  placeholder="রোড # ০৩, কোনাবাড়ী বিসিক শিল্প এলাকা, গাজীপুর..."
                  className="w-full p-1.5 bg-white border border-blue-300 rounded-lg text-xs"
                />
              </div>
            </div>

            {/* Contract Rules & Clauses Section in Drawer */}
            <div className="pt-2 border-t border-blue-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-700" />
                  <span>চুক্তিপত্রের শর্তাবলি ও নিয়ম-কানুন ({contractRules.length} টি শর্ত):</span>
                </label>
                <span className="text-[10px] text-blue-800 font-medium">প্রতিটি শর্ত সরাসরি সম্পাদনযোগ্য</span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {contractRules.map((rule, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 bg-white p-1.5 rounded-lg border border-blue-200">
                    <span className="font-black text-slate-700 text-xs px-1.5 py-0.5 bg-blue-100 rounded shrink-0">
                      {toBengaliNumber(idx + 1)}
                    </span>
                    <textarea
                      rows={1}
                      value={rule}
                      onChange={(e) => handleUpdateModalRule(idx, e.target.value)}
                      className="w-full p-1 text-xs border border-slate-200 rounded outline-none focus:border-blue-400 resize-y"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteModalRule(idx)}
                      title="শর্ত মুছুন"
                      className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Rule */}
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={newRuleInput}
                  onChange={(e) => setNewRuleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddModalRule();
                    }
                  }}
                  placeholder="নতুন কোনো নিয়ম বা শর্ত লিখুন..."
                  className="flex-1 p-1.5 bg-white border border-blue-300 rounded-lg text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddModalRule}
                  className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ শর্ত যোগ করুন</span>
                </button>
              </div>

              {/* Declaration Text */}
              <div className="pt-1">
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">শ্রমিকের ঘোষণাবাক্য (Declaration):</label>
                <input
                  type="text"
                  value={contractDeclaration}
                  onChange={(e) => setContractDeclaration(e.target.value)}
                  placeholder="আমি উক্ত কারখানার সকল নিয়ম মেনে কাজ করবো।"
                  className="w-full p-1.5 bg-white border border-blue-300 rounded-lg text-xs font-semibold"
                />
              </div>
            </div>

            <div className="flex justify-between items-center gap-2 pt-2 border-t border-blue-200">
              <button
                type="button"
                onClick={() => {
                  setFactoryName(DEFAULT_FACTORY_SETTINGS.name);
                  setFactoryNameEn(DEFAULT_FACTORY_SETTINGS.nameEn || '');
                  setFactoryAddress(DEFAULT_FACTORY_SETTINGS.address);
                  setFactoryPhone(DEFAULT_FACTORY_SETTINGS.phone);
                  setFactoryEmail(DEFAULT_FACTORY_SETTINGS.email || '');
                  setContractRules(DEFAULT_CONTRACT_RULES);
                  setContractDeclaration(DEFAULT_CONTRACT_DECLARATION);
                  showToast('ডিফল্ট ৮টি শর্ত ও তথ্য রিস্টোর করা হয়েছে');
                }}
                className="py-1 px-3 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>ডিফল্ট তথ্য ও ৮টি শর্ত রিস্টোর</span>
              </button>
              <button
                type="button"
                disabled={isSavingFactory}
                onClick={handleSaveFactorySettings}
                className="py-1 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingFactory ? 'সংরক্ষণ হচ্ছে...' : 'কারখানার তথ্য ও চুক্তি Save করুন'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Bank Info Drawer (No-Print) */}
        {isEditingBank && (
          <div className="bg-amber-50 border-b border-amber-200 p-3 sm:px-5 text-xs text-amber-950 space-y-2 no-print shrink-0 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-amber-700" />
                <span>চুক্তিপত্রে প্রদর্শনের জন্য শ্রমিকের ব্যাংক ও একাউন্ট তথ্য সম্পাদনা:</span>
              </span>
              <button
                type="button"
                onClick={() => setIsEditingBank(false)}
                className="text-amber-800 hover:text-amber-950 font-bold"
              >
                ✕ বন্ধ
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">ব্যাংক নাম</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="যেমন: ডাচ বাংলা ব্যাংক / বিকাশ"
                  className="w-full p-1.5 bg-white border border-amber-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">একাউন্ট নাম</label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="শ্রমিকের নাম অনুযায়ী"
                  className="w-full p-1.5 bg-white border border-amber-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">একাউন্ট নাম্বার</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="যেমন: ১২৩.১০১.XXXXX"
                  className="w-full p-1.5 bg-white border border-amber-300 rounded-lg text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isSavingBank}
                onClick={handleSaveBankInfo}
                className="py-1 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingBank ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Container with Printable A4 Page Preview */}
        <div className="flex-1 overflow-y-auto overflow-x-auto p-2 sm:p-5 bg-slate-200/90 flex justify-center print:overflow-visible print:p-0 print:bg-white print:block">
          <div
            style={{
              transform: zoomLevel !== 1 ? `scale(${zoomLevel})` : undefined,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out',
            }}
            className="w-full max-w-[780px] flex justify-center print:transform-none"
          >
            {/* ======================================================== */}
            {/* THE OFFICIAL SINGLE-PAGE A4 CONTRACT LETTER             */}
            {/* Precision calibrated to strictly fit on EXACTLY ONE PAGE */}
            {/* ======================================================== */}
            <div
              id="workerContractLetterA4Area"
              ref={contractPrintRef}
              className="bg-white text-slate-900 shadow-xl border border-slate-300 w-full max-w-[780px] p-5 sm:p-6 relative flex flex-col justify-between print:shadow-none print:border-none print:max-w-none"
              style={{
                fontFamily: '"Noto Sans Bengali", "Kalpurush", sans-serif',
                boxSizing: 'border-box',
              }}
            >
            {/* Subtle Official Watermark Background */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none z-0">
              <div className="text-center font-black tracking-widest text-slate-950 uppercase rotate-[-25deg]">
                <div className="text-5xl sm:text-6xl font-black">{factory.nameEn || 'TEXWARE APPARELS'}</div>
                <div className="text-lg mt-1 tracking-normal font-bold">শ্রমিক নিয়োগ চুক্তিপত্র</div>
              </div>
            </div>

            <div className="relative z-10 space-y-2">
              
              {/* ================= 1. OFFICIAL FACTORY LETTERHEAD WITH TOP-LEFT PHOTO ================= */}
              <div className="border-b-2 border-slate-900 pb-2">
                <div className="flex items-start justify-between gap-3">
                  
                  {/* TOP-LEFT CORNER: WORKER PASSPORT PHOTO (As requested: image on top left side) */}
                  <div className="shrink-0 flex flex-col items-center">
                    <div className="w-[84px] h-[100px] border-2 border-slate-800 bg-slate-50 rounded p-0.5 shadow-xs flex flex-col items-center justify-center relative overflow-hidden">
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

                  {/* CENTER & RIGHT: OFFICIAL FACTORY NAME, ADDRESS, CONTACT */}
                  <div className="flex-1 text-center pr-2">
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
                      <Phone className="w-2.5 h-2.5 inline-block text-slate-500 mr-0.5" />
                      ফোন: {factoryPhone || factory.phone}
                      {factory.email ? ` | ইমেইল: ${factory.email}` : ''}
                    </p>
                  </div>

                  {/* Top Right: Seal Placeholder / Official Brand Logo */}
                  <div className="shrink-0 flex flex-col items-center justify-center w-[74px] text-right">
                    <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-sm border border-slate-700 shadow-2xs mx-auto">
                      TW
                    </div>
                    <span className="text-[7.5px] font-bold text-slate-500 mt-1 uppercase">ESTABLISHED</span>
                  </div>

                </div>

                {/* Memo / Ref No & Date Bar */}
                <div className="flex items-center justify-between text-[10.5px] text-slate-700 font-semibold pt-1 mt-1 border-t border-dotted border-slate-300">
                  <div>
                    <span>স্মারক নং: </span>
                    <strong className="text-slate-950 font-mono text-[11px]">
                      TWA/HR/CON-{employee.workerId || '001'}
                    </strong>
                  </div>
                  <div>
                    <span>তারিখ: </span>
                    <strong className="text-slate-950 font-medium">
                      {formatDateBn(employee.joinDate || new Date().toISOString())}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Document Main Heading Banner */}
              <div className="text-center py-0.5">
                <span className="inline-block px-4 py-0.5 rounded bg-slate-100 border border-slate-500 text-slate-950 text-xs sm:text-sm font-black tracking-wide shadow-2xs">
                  শ্রমিক নিয়োগ ও সম্মতি চুক্তিপত্র
                </span>
                <p className="text-[9px] text-slate-500 mt-0.5 font-semibold">
                  (বাংলাদেশ শ্রম আইন ও কারখানার চাকরি বিধিমালা অনুযায়ী)
                </p>
              </div>

              {/* ================= 2. WORKER PARTICULARS, SALARY & BANK DETAILS (COMPACT TABLE) ================= */}
              <div className="border border-slate-400 rounded overflow-hidden text-[10.5px]">
                <table className="w-full border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-300 bg-slate-50/70">
                      <td className="p-1 px-2 text-slate-600 font-bold w-[18%]">শ্রমিকের নাম:</td>
                      <td className="p-1 px-2 font-black text-slate-950 w-[32%] text-[11.5px]">{employee.name}</td>
                      <td className="p-1 px-2 text-slate-600 font-bold w-[18%]">Worker ID:</td>
                      <td className="p-1 px-2 font-black text-blue-900 font-mono w-[32%]">{employee.workerId}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="p-1 px-2 text-slate-600 font-bold">পদবি (Designation):</td>
                      <td className="p-1 px-2 font-bold text-slate-900">{employee.designation}</td>
                      <td className="p-1 px-2 text-slate-600 font-bold">শাখা / সেকশন:</td>
                      <td className="p-1 px-2 text-slate-800">{employee.department || 'সাধারণ'}</td>
                    </tr>
                    <tr className="border-b border-slate-300 bg-slate-50/70">
                      <td className="p-1 px-2 text-slate-600 font-bold">জাতীয় পরিচয়পত্র (NID):</td>
                      <td className="p-1 px-2 font-semibold text-slate-900 font-mono">{employee.nid || 'কার্যালয়ে সংরক্ষিত'}</td>
                      <td className="p-1 px-2 text-slate-600 font-bold">মোবাইল নম্বর:</td>
                      <td className="p-1 px-2 font-semibold text-slate-900 font-mono">{employee.mobile || '—'}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="p-1 px-2 text-slate-600 font-bold">যোগদানের তারিখ:</td>
                      <td className="p-1 px-2 text-slate-800">{formatDateBn(employee.joinDate)}</td>
                      <td className="p-1 px-2 text-slate-600 font-bold">জন্ম তারিখ:</td>
                      <td className="p-1 px-2 text-slate-800">{formatDateBn(employee.birthDate)}</td>
                    </tr>
                    <tr className="border-b border-slate-300 bg-slate-50/70">
                      <td className="p-1 px-2 text-slate-600 font-bold">স্থায়ী ও বর্তমান ঠিকানা:</td>
                      <td colSpan={3} className="p-1 px-2 text-slate-800 leading-tight">
                        {employee.address || 'কারখানা রেকর্ড অনুযায়ী স্থায়ী ঠিকানা'}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-300 bg-blue-50/40">
                      <td className="p-1 px-2 text-slate-800 font-bold">শ্রমিকের মাসিক বেতন:</td>
                      <td className="p-1 px-2 font-black text-blue-900 text-[11px]">{formatMoney(employee.salary)} ৳ (টাকা)</td>
                      <td className="p-1 px-2 text-slate-800 font-bold">অভারটাইম ভাতা (ঘণ্টা):</td>
                      <td className="p-1 px-2 font-black text-slate-900">{formatMoney(employee.otRate)} ৳</td>
                    </tr>
                    <tr className="bg-amber-50/30">
                      <td className="p-1 px-2 text-slate-800 font-bold">হাজিরা বোনাস (নিয়মিত):</td>
                      <td className="p-1 px-2 font-bold text-emerald-800">৫০০ ৳</td>
                      <td className="p-1 px-2 text-slate-800 font-bold">ব্যাংক তথ্য:</td>
                      <td className="p-1 px-2 text-[10px]">
                        <span className="font-semibold text-slate-900">
                          {employee.bankName || 'ডাচ বাংলা ব্যাংক / মোবাইল একাউন্ট'}
                        </span>
                        {' | '}
                        <span className="font-mono font-bold text-slate-950">
                          হিসাব: {employee.accountNumber || employee.mobile || 'রেকর্ডভুক্ত নয়'}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ================= 3. CONTRACT CONDITIONS & RULES ================= */}
              <div className="space-y-1 pt-0.5">
                <div className="font-black text-slate-950 text-[11px] border-b border-slate-700 pb-0.5 flex items-center justify-between">
                  <span>চুক্তির শর্তাবলি ও কারখানার নিয়ম-কানুন:</span>
                  <span className="text-[9px] font-bold text-slate-600">কোড অব কন্ডাক্ট</span>
                </div>

                <ol className="space-y-1 text-[10px] sm:text-[10.5px] text-slate-900 leading-snug list-none">
                  {(factory.contractRules && factory.contractRules.length > 0
                    ? factory.contractRules
                    : DEFAULT_CONTRACT_RULES
                  ).map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <span className="font-bold shrink-0 text-slate-950">{toBengaliNumber(idx + 1)}.</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ol>

                {/* Worker's Declaration */}
                <div className="mt-1 p-1 bg-slate-100 rounded border border-slate-300 text-center font-bold text-slate-950 text-[10.5px]">
                  <span>"{factory.contractDeclaration || DEFAULT_CONTRACT_DECLARATION}"</span>
                </div>
              </div>

              {/* ================= 4. SIGNATURE & STAMP SECTION ================= */}
              <div className="pt-6 grid grid-cols-3 gap-3 text-center text-[10.5px]">
                {/* 1. Worker Signature & Thumb Impression */}
                <div className="flex flex-col items-center justify-end relative">
                  <div className="h-10 flex items-end justify-center pb-0.5 w-full">
                    {safeSignatureUrl || employee.signatureUrl ? (
                      <img
                        src={safeSignatureUrl || employee.signatureUrl}
                        alt="শ্রমিকের স্বাক্ষর"
                        className="max-h-9 max-w-[130px] object-contain filter contrast-125"
                      />
                    ) : (
                      /* শ্রমিকের স্বাক্ষরের উপর সম্পূর্ণ ফাঁকা স্থান (Blank space for manual signing/thumb) */
                      <div className="h-9 w-full" />
                    )}
                  </div>
                  <div className="w-32 sm:w-36 border-t-2 border-slate-800 pt-0.5">
                    <div className="font-bold text-slate-950 text-[11px]">শ্রমিকের স্বাক্ষর / টিপসই</div>
                    <div className="text-[8.5px] text-slate-500">তারিখ সহ (Worker Signature)</div>
                  </div>
                </div>

                {/* 2. Witness Signatures */}
                <div className="flex flex-col items-center justify-end">
                  <div className="h-10 flex items-end justify-center pb-0.5 w-full">
                    {/* সাক্ষীর স্বাক্ষরের উপর ফাঁকা স্থান (Blank space for witnesses) */}
                    <div className="h-9 w-full" />
                  </div>
                  <div className="w-32 sm:w-36 border-t-2 border-slate-800 pt-0.5">
                    <div className="font-bold text-slate-950 text-[11px]">সাক্ষীর স্বাক্ষর ও নাম</div>
                    <div className="text-[8.5px] text-slate-500">১ম ও ২য় সাক্ষী (Witnesses)</div>
                  </div>
                </div>

                {/* 3. Factory Authority / Owner */}
                <div className="flex flex-col items-center justify-end">
                  <div className="h-10 flex items-end justify-center pb-0.5 w-full">
                    {/* কারখানার মালিক বা কর্তৃপক্ষের স্বাক্ষরের উপর সম্পূর্ণ ফাঁকা স্থান (Blank space for manual authority signature & official seal) */}
                    <div className="h-9 w-full" />
                  </div>
                  <div className="w-32 sm:w-36 border-t-2 border-slate-800 pt-0.5">
                    <div className="font-bold text-slate-950 text-[11px]">মালিকপক্ষ / কারখানা কর্তৃপক্ষ</div>
                    <div className="text-[8.5px] text-slate-500">স্বাক্ষর ও সিলমোহর</div>
                  </div>
                </div>
              </div>

              {/* Document Single-Page Footer */}
              <div className="text-center text-[8px] text-slate-400 border-t border-slate-200 mt-2 pt-0.5 flex items-center justify-between">
                <span>{factory.name} — প্রশাসন ও মানবসম্পদ বিভাগ</span>
                <span>প্রিন্ট তারিখ: {new Date().toLocaleDateString('bn-BD')}</span>
                <span>A4 সাইজ একক পাতা চুক্তিপত্র (Single Page Document)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

        {/* Modal Bottom Action Footer (No-Print) */}
        <div className="p-2.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0 no-print">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="hidden md:inline">সম্পূর্ণ তথ্যসহ একক A4 পাতায় নির্ভুলভাবে ডাউনলোড ও প্রিন্ট হবে।</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isDownloadingImage}
              onClick={handleDownloadImage}
              className="py-1.5 px-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              title="উচ্চ মানের PNG ছবি হিসেবে ডাউনলোড করুন"
            >
              {isDownloadingImage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span>ছবি (PNG)</span>
            </button>

            <button
              type="button"
              disabled={isDownloadingPDF}
              onClick={handleDownloadPDF}
              className="py-1.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              title="সম্পূর্ণ A4 সাইজ PDF ডাউনলোড করুন"
            >
              {isDownloadingPDF ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-white" />
              )}
              <span>PDF ডাউনলোড</span>
            </button>

            <button
              type="button"
              onClick={handlePrintContract}
              className="py-1.5 px-4 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>A4 প্রিন্ট</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-1.5 px-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
