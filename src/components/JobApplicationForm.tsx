import React, { useState, useRef, useEffect } from 'react';
import { JobApplication, FactorySettings } from '../types';
import { submitJobApplication, DEFAULT_FACTORY_SETTINGS, loadFactorySettings } from '../lib/firebase';
import { compressImageFile, compressSignatureImage } from '../lib/imageUtils';
import { JobApplicationPrintModal } from './JobApplicationPrintModal';
import { BlankJobApplicationModal } from './BlankJobApplicationModal';
import {
  Shirt,
  User,
  Users,
  Camera,
  Upload,
  FileSignature,
  FileText,
  CheckCircle,
  Copy,
  ExternalLink,
  RotateCcw,
  Sparkles,
  Phone,
  CreditCard,
  MapPin,
  Calendar,
  Building2,
  Briefcase,
  AlertCircle,
  Share2,
  ArrowLeft,
  PenTool,
  Eye,
  Printer,
  Download
} from 'lucide-react';

interface JobApplicationFormProps {
  onBackToApp?: () => void;
  showToast: (msg: string) => void;
  isStandalone?: boolean;
}

const COMMON_GARMENT_POSITIONS = [
  'সুইং অপারেটর',
  'সিনিয়র সুইং অপারেটর',
  'জুনিয়র সুইং অপারেটর',
  'হেল্পার (সুইং সেকশন)',
  'হেল্পার (ফিনিশিং সেকশন)',
  'কোয়ালিটি ইন্সপেক্টর (QI)',
  'কোয়ালিটি কন্ট্রোলার (QC)',
  'আয়রন ম্যান / প্রেসম্যান',
  'কাটিং মাস্টার',
  'কাটিং হেল্পার',
  'প্যাকিং ও ফোল্ডিং ম্যান',
  'লাইন সুপারভাইজার',
  'মেইনটেন্যান্স মেকানিক',
  'অন্যান্য পদ',
];

const GARMENT_DEPARTMENTS = [
  'সুইং সেকশন (Sewing)',
  'ফিনিশিং সেকশন (Finishing)',
  'কাটিং সেকশন (Cutting)',
  'কোয়ালিটি সেকশন (Quality)',
  'ওয়াশিং সেকশন (Washing)',
  'স্যাম্পল সেকশন (Sample)',
  'স্টোর ও প্যাকিং (Store & Packing)',
];

export const JobApplicationForm: React.FC<JobApplicationFormProps> = ({
  onBackToApp,
  showToast,
  isStandalone = false,
}) => {
  const [factory, setFactory] = useState<FactorySettings>(DEFAULT_FACTORY_SETTINGS);

  // Form Fields State
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [nid, setNid] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [age, setAge] = useState<number | string>('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('female');
  const [maritalStatus, setMaritalStatus] = useState<'married' | 'unmarried' | 'divorced' | 'widowed'>('married');
  const [bloodGroup, setBloodGroup] = useState('');
  const [mobile, setMobile] = useState('');
  const [altMobile, setAltMobile] = useState('');

  const [presentAddress, setPresentAddress] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [sameAsPresent, setSameAsPresent] = useState(false);

  const [appliedDesignation, setAppliedDesignation] = useState(COMMON_GARMENT_POSITIONS[0]);
  const [customDesignation, setCustomDesignation] = useState('');
  const [department, setDepartment] = useState(GARMENT_DEPARTMENTS[0]);
  const [experience, setExperience] = useState('');
  const [education, setEducation] = useState('অষ্টম শ্রেণি / জেএসসি');

  // Photo & Signature
  const [photoUrl, setPhotoUrl] = useState('');
  const [signatureUrl, setSignatureUrl] = useState('');
  const [signatureMode, setSignatureMode] = useState<'pad' | 'upload'>('pad');
  const [isDrawing, setIsDrawing] = useState(false);

  // Guardian Information & Photo
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelation, setGuardianRelation] = useState('স্বামী');
  const [guardianMobile, setGuardianMobile] = useState('');
  const [guardianNid, setGuardianNid] = useState('');
  const [guardianAddress, setGuardianAddress] = useState('');
  const [guardianPhotoUrl, setGuardianPhotoUrl] = useState('');

  // Bank / Mobile Banking
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  // Consent
  const [declarationAgreed, setDeclarationAgreed] = useState(true);

  // Status & Success state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedApp, setSubmittedApp] = useState<JobApplication | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [previewDraftApp, setPreviewDraftApp] = useState<JobApplication | null>(null);
  const [isBlankModalOpen, setIsBlankModalOpen] = useState(false);

  const handlePreviewClick = () => {
    const finalDesignation =
      appliedDesignation === 'অন্যান্য পদ' && customDesignation.trim()
        ? customDesignation.trim()
        : appliedDesignation;

    const draft: JobApplication = {
      id: 'draft_preview_temp',
      applicationNo: 'TW-APP-PREVIEW',
      status: 'pending',
      name: name.trim() || 'আবেদনকারীর নাম (নমুনা)',
      nameEn: nameEn.trim() || undefined,
      fatherName: fatherName.trim() || 'পিতার নাম',
      motherName: motherName.trim() || 'মাতার নাম',
      nid: nid.trim() || 'NID নম্বর',
      birthDate: birthDate || new Date().toISOString().split('T')[0],
      age: age ? Number(age) : undefined,
      gender: gender,
      maritalStatus: maritalStatus,
      bloodGroup: bloodGroup.trim() || undefined,
      mobile: mobile.trim() || '০১XXXXXXXXX',
      altMobile: altMobile.trim() || undefined,
      presentAddress: presentAddress.trim() || 'বর্তমান ঠিকানা',
      permanentAddress: (sameAsPresent ? presentAddress : permanentAddress).trim() || 'স্থায়ী ঠিকানা',
      appliedDesignation: finalDesignation,
      department: department,
      experience: experience.trim() || 'কাজের অভিজ্ঞতা উল্লেখ করা হয়নি',
      education: education.trim() || 'মাধ্যমিক',
      photoUrl: photoUrl || '',
      signatureUrl: signatureUrl || '',
      guardianName: guardianName.trim() || 'অভিভাবকের নাম',
      guardianRelation: guardianRelation.trim() || 'অভিভাবক',
      guardianNid: guardianNid.trim() || undefined,
      guardianMobile: guardianMobile.trim() || '০১XXXXXXXXX',
      guardianAddress: guardianAddress.trim() || presentAddress.trim() || 'অভিভাবকের ঠিকানা',
      guardianPhotoUrl: guardianPhotoUrl || '',
      bankName: bankName.trim() || undefined,
      accountNumber: accountNumber.trim() || undefined,
      createdAt: Date.now(),
    };
    setPreviewDraftApp(draft);
  };

  // Refs
  const photoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const guardianPhotoInputRef = useRef<HTMLInputElement>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load Factory Settings
  useEffect(() => {
    loadFactorySettings().then((cfg) => setFactory(cfg));
  }, []);

  // Calculate age from birthdate
  const handleBirthDateChange = (val: string) => {
    setBirthDate(val);
    if (val) {
      const birth = new Date(val);
      const now = new Date();
      let diffYears = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
        diffYears--;
      }
      setAge(diffYears > 0 ? diffYears : '');
    } else {
      setAge('');
    }
  };

  // Same as present address handler
  const handleSameAddressToggle = (checked: boolean) => {
    setSameAsPresent(checked);
    if (checked) {
      setPermanentAddress(presentAddress);
    }
  };

  // Photo upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 480, 480, 0.82);
      setPhotoUrl(compressed);
      showToast('শ্রমিকের ছবি সফলভাবে আপলোড হয়েছে');
    } catch {
      showToast('ছবি প্রসেস করতে ব্যর্থ হয়েছে');
    }
  };

  // Guardian Photo upload handler
  const handleGuardianPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 480, 480, 0.82);
      setGuardianPhotoUrl(compressed);
      showToast('অভিভাবকের ছবি সফলভাবে আপলোড হয়েছে');
    } catch {
      showToast('ছবি প্রসেস করতে ব্যর্থ হয়েছে');
    }
  };

  // Signature image file upload handler
  const handleSignatureFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressSignatureImage(file, 400, 150);
      setSignatureUrl(compressed);
      showToast('ডিজিটাল স্বাক্ষর ছবি হিসেবে গৃহীত হয়েছে');
    } catch {
      showToast('স্বাক্ষর প্রসেস করতে ব্যর্থ হয়েছে');
    }
  };

  // Canvas Pad Drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f2963'; // deep blue ink
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = sigCanvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      setSignatureUrl(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setSignatureUrl('');
  };

  // Public Link Generation
  const getShareableLink = () => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const pathname = window.location.pathname;
      return `${origin}${pathname}?mode=apply`;
    }
    return '';
  };

  const handleCopyLink = () => {
    const link = getShareableLink();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link);
      showToast('আবেদন ফরমের স্থায়ী লিংক কপি হয়েছে!');
    } else {
      showToast('লিংক: ' + link);
    }
  };

  // Submit Application Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast('অনুগ্রহ করে আবেদনকারীর নাম প্রদান করুন');
      return;
    }
    if (!fatherName.trim() || !motherName.trim()) {
      showToast('পিতা ও মাতার নাম আবশ্যক');
      return;
    }
    if (!nid.trim()) {
      showToast('জাতীয় পরিচয়পত্র (NID) বা জন্ম নিবন্ধন নম্বর দিন');
      return;
    }
    if (!birthDate) {
      showToast('জন্ম তারিখ প্রদান করুন');
      return;
    }
    if (!mobile.trim() || mobile.trim().length < 11) {
      showToast('সঠিক ১১ ডিজিটের মোবাইল নম্বর প্রদান করুন');
      return;
    }
    if (!presentAddress.trim()) {
      showToast('বর্তমান ঠিকানা আবশ্যক');
      return;
    }
    if (!guardianName.trim() || !guardianMobile.trim()) {
      showToast('অভিভাবকের নাম ও মোবাইল নম্বর আবশ্যক');
      return;
    }
    if (!declarationAgreed) {
      showToast('অনুগ্রহ করে অঙ্গীকারনামায় সম্মতি দিন');
      return;
    }

    setIsSubmitting(true);
    try {
      const finalDesignation =
        appliedDesignation === 'অন্যান্য পদ' && customDesignation.trim()
          ? customDesignation.trim()
          : appliedDesignation;

      const payload = {
        name: name.trim(),
        nameEn: nameEn.trim() || undefined,
        fatherName: fatherName.trim(),
        motherName: motherName.trim(),
        nid: nid.trim(),
        birthDate: birthDate,
        age: age ? Number(age) : undefined,
        gender: gender,
        maritalStatus: maritalStatus,
        bloodGroup: bloodGroup.trim() || undefined,
        mobile: mobile.trim(),
        altMobile: altMobile.trim() || undefined,
        presentAddress: presentAddress.trim(),
        permanentAddress: (sameAsPresent ? presentAddress : permanentAddress).trim() || presentAddress.trim(),
        appliedDesignation: finalDesignation,
        department: department,
        experience: experience.trim() || 'নতুন আবেদনকারী',
        education: education.trim() || undefined,
        photoUrl: photoUrl || '',
        signatureUrl: signatureUrl || '',
        guardianName: guardianName.trim(),
        guardianRelation: guardianRelation.trim(),
        guardianNid: guardianNid.trim() || undefined,
        guardianMobile: guardianMobile.trim(),
        guardianAddress: (guardianAddress.trim() || presentAddress.trim()),
        guardianPhotoUrl: guardianPhotoUrl || '',
        bankName: bankName.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
      };

      const result = await submitJobApplication(payload);

      const completeCreatedApp: JobApplication = {
        ...payload,
        id: result.id,
        applicationNo: result.applicationNo,
        status: 'pending',
        createdAt: Date.now(),
      };

      setSubmittedApp(completeCreatedApp);
      showToast('আপনার আবেদন গৃহীত হয়েছে! অনুগ্রহ করে অপেক্ষা করুন আপনার সাথে ৩ কার্যদিবস এর মধ্যে যোগাযোগ করা হবে।');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      showToast('আবেদন জমা দিতে সমস্যা হয়েছে, অনুগ্রহ করে পুনরায় চেষ্টা করুন');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmittedApp(null);
    setName('');
    setNameEn('');
    setFatherName('');
    setMotherName('');
    setNid('');
    setBirthDate('');
    setAge('');
    setMobile('');
    setAltMobile('');
    setPresentAddress('');
    setPermanentAddress('');
    setPhotoUrl('');
    setSignatureUrl('');
    setGuardianName('');
    setGuardianMobile('');
    setGuardianNid('');
    setGuardianAddress('');
    setGuardianPhotoUrl('');
    setBankName('');
    setAccountNumber('');
    setExperience('');
    clearCanvas();
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Quick Share Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden border border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white p-0.5 border border-white/20 flex items-center justify-center shrink-0 shadow-inner overflow-hidden">
              <img src="/logo.png" alt="টেক্স ওয়ার লোগো" className="w-full h-full object-contain rounded-xl" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg md:text-xl font-black text-white">
                  {factory.name || 'টেক্স ওয়ার অ্যাপারেলস'}
                </h1>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  শ্রমিক নিয়োগ পোর্টাল
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                নতুন শ্রমিক ও কর্মচারী নিয়োগ অনলাইন আবেদন ফরম (Job Application Portal)
              </p>
            </div>
          </div>

          {/* Quick Actions: Blank Form, Copy Permanent Link & Back to App */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsBlankModalOpen(true)}
              title="হাতে পূরণের ফাঁকা আবেদন ফরম দেখুন, প্রিন্ট ও PDF ডাউনলোড করুন"
              className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>হাতে পূরণের ফাঁকা ফরম (প্রিন্ট / PDF)</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              title="স্থায়ী আবেদন লিংক কপি করুন"
              className="px-3 py-1.5 rounded-xl bg-blue-500/25 hover:bg-blue-500/35 border border-blue-400/30 text-blue-200 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>আবেদন লিংক কপি</span>
            </button>

            {onBackToApp && !isStandalone && (
              <button
                type="button"
                onClick={onBackToApp}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>প্রধান অ্যাপে ফিরুন</span>
              </button>
            )}
          </div>
        </div>

        {/* Sharable URL Informational Banner */}
        <div className="mt-3 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span>
              <b>স্থায়ী আবেদন লিংক:</b> যে কাউকে এই লিংক দিলে সে ঘরে বসেই আবেদন করতে পারবে এবং স্বয়ংক্রিয়ভাবে কারখানায় জমা হবে।
            </span>
          </div>
          <div className="font-mono text-[11px] bg-slate-950/50 px-2.5 py-1 rounded-lg border border-white/10 text-amber-300 select-all truncate max-w-xs">
            {getShareableLink()}
          </div>
        </div>
      </div>

      {/* If Application Was Submitted: Success View */}
      {submittedApp ? (
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 text-center space-y-5 animate-in fade-in duration-300">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-emerald-300">
            <CheckCircle className="w-10 h-10" />
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              আবেদন সফলভাবে দাখিল হয়েছে
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
              ধন্যবাদ, আপনার চাকরির আবেদন গৃহীত হয়েছে!
            </h2>
            <div className="mt-4 p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl max-w-lg mx-auto shadow-sm text-center">
              <p className="text-sm sm:text-base font-black text-amber-950 flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
                <span>অনুগ্রহ করে অপেক্ষা করুন আপনার সাথে ৩ কার্যদিবস এর মধ্যে যোগাযোগ করা হবে।</span>
              </p>
              <p className="text-xs text-amber-800 mt-1.5 font-medium">
                কর্তৃপক্ষ আপনার প্রদত্ত তথ্য ও প্রমাণপত্র যাচাই শেষে সরাসরি ফোনে যোগাযোগ করবে।
              </p>
            </div>
          </div>

          {/* Tracking Card */}
          <div className="max-w-md mx-auto p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-semibold">আবেদন ট্র্যাকিং নম্বর:</span>
              <span className="font-mono font-black text-base text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                {submittedApp.applicationNo}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-semibold">আবেদনকারীর নাম:</span>
              <span className="font-bold text-slate-900">{submittedApp.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-semibold">আবেদনকৃত পদ:</span>
              <span className="font-bold text-slate-900">{submittedApp.appliedDesignation}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-semibold">মোবাইল নম্বর:</span>
              <span className="font-mono font-bold text-slate-900">{submittedApp.mobile}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-semibold">জাতীয় পরিচয়পত্র:</span>
              <span className="font-mono font-bold text-slate-900">{submittedApp.nid}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>আবেদন ফরম প্রিন্ট ও PDF ডাউনলোড</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBlankModalOpen(true)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition active:scale-95"
            >
              <FileText className="w-4 h-4" />
              <span>হাতে পূরণের ফাঁকা ফরম</span>
            </button>

            <button
              type="button"
              onClick={handleResetForm}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>আরেকটি নতুন আবেদন করুন</span>
            </button>
          </div>
        </div>
      ) : (
        /* The Application Form */
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Form Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>শ্রমিক / কর্মচারী নিয়োগ আবেদন ফরম পূরণ করুন</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              জাতীয় পরিচয়পত্র (NID) বা জন্ম নিবন্ধন অনুযায়ী সকল তথ্য নির্ভুলভাবে প্রদান করুন। লাল তারকা (*) চিহ্নিত ঘরগুলো আবশ্যক।
            </p>
          </div>

          <div className="p-4 sm:p-6 space-y-6">
            {/* SECTION 1: APPLICANT PERSONAL INFO */}
            <div>
              <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-200">
                <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">১</span>
                <h3 className="font-bold text-sm text-slate-900">
                  আবেদনকারীর ব্যক্তিগত তথ্য (জাতীয় পরিচয়পত্র অনুযায়ী)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
                {/* Name Bangla */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    আবেদনকারীর নাম (বাংলায়) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="যেমন: মোছাঃ সুমি আক্তার"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Name English */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Name in English (Block Letters)
                  </label>
                  <input
                    type="text"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="e.g. MST SUMI AKTER"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Father's Name */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    পিতার নাম <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    placeholder="পিতার নাম"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Mother's Name */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    মাতার নাম <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={motherName}
                    onChange={(e) => setMotherName(e.target.value)}
                    placeholder="মাতার নাম"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* NID / Birth Cert */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    জাতীয় পরিচয়পত্র (NID) বা জন্ম নিবন্ধন নং <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nid}
                    onChange={(e) => setNid(e.target.value)}
                    placeholder="১০, ১৩ বা ১৭ ডিজিটের NID নম্বর"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Birth Date & Age */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    জন্ম তারিখ <span className="text-rose-500">*</span>
                    {age ? (
                      <span className="ml-2 font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px]">
                        বয়স: {age} বছর
                      </span>
                    ) : null}
                  </label>
                  <input
                    type="date"
                    required
                    value={birthDate}
                    onChange={(e) => handleBirthDateChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    লিঙ্গ <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="female">মহিলা (Female)</option>
                    <option value="male">পুরুষ (Male)</option>
                    <option value="other">অন্যান্য (Other)</option>
                  </select>
                </div>

                {/* Marital Status */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    বৈবাহিক অবস্থা
                  </label>
                  <select
                    value={maritalStatus}
                    onChange={(e) => setMaritalStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="married">বিবাহিত (Married)</option>
                    <option value="unmarried">অবিবাহিত (Single)</option>
                    <option value="widowed">বিধবা (Widowed)</option>
                    <option value="divorced">তালাকপ্রাপ্ত (Divorced)</option>
                  </select>
                </div>

                {/* Blood Group */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    রক্তের গ্রুপ (Blood Group)
                  </label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">নির্বাচন করুন</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>

                {/* Mobile No */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    মোবাইল নম্বর <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="017xxxxxxxx"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Alt Mobile No */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    বিকল্প মোবাইল নম্বর
                  </label>
                  <input
                    type="tel"
                    value={altMobile}
                    onChange={(e) => setAltMobile(e.target.value)}
                    placeholder="018xxxxxxxx (ঐচ্ছিক)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Education */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    শিক্ষাগত যোগ্যতা
                  </label>
                  <input
                    type="text"
                    value={education}
                    onChange={(e) => setEducation(e.target.value)}
                    placeholder="যেমন: পঞ্চম শ্রেণি / অষ্টম শ্রেণি / এসএসসি"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Address Rows */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    বর্তমান ঠিকানা <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={presentAddress}
                    onChange={(e) => {
                      setPresentAddress(e.target.value);
                      if (sameAsPresent) setPermanentAddress(e.target.value);
                    }}
                    placeholder="বাড়ি নং, রোড/লাইন, এলাকা, থানা, জেলা"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-800">
                      স্থায়ী ঠিকানা <span className="text-rose-500">*</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] text-blue-700 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sameAsPresent}
                        onChange={(e) => handleSameAddressToggle(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                      />
                      <span>বর্তমান ঠিকানার অনুরূপ</span>
                    </label>
                  </div>
                  <textarea
                    required
                    rows={2}
                    disabled={sameAsPresent}
                    value={sameAsPresent ? presentAddress : permanentAddress}
                    onChange={(e) => setPermanentAddress(e.target.value)}
                    placeholder="গ্রাম, ডাকঘর, থানা/উপজেলা, জেলা"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: APPLIED POSITION & SALARY */}
            <div>
              <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-200">
                <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">২</span>
                <h3 className="font-bold text-sm text-slate-900">
                  আবেদনকৃত পদ ও যোগ্যতার বিবরণ
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
                {/* Applied Designation */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    আবেদনকৃত পদ <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={appliedDesignation}
                    onChange={(e) => setAppliedDesignation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {COMMON_GARMENT_POSITIONS.map((pos) => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>

                {/* Custom Designation if 'other' */}
                {appliedDesignation === 'অন্যান্য পদ' && (
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      নির্দিষ্ট পদের নাম লিখুন <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customDesignation}
                      onChange={(e) => setCustomDesignation(e.target.value)}
                      placeholder="পদের নাম লিখুন"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                )}

                {/* Section / Department */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    পছন্দনীয় সেকশন / বিভাগ
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {GARMENT_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                {/* Previous Experience */}
                <div className="sm:col-span-2 md:col-span-3">
                  <label className="block font-bold text-slate-800 mb-1">
                    কাজের অভিজ্ঞতা (কোন কারখানায় কত বছর কাজ করেছেন)
                  </label>
                  <textarea
                    rows={2}
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    placeholder="যেমন: ২ বছর এ্যাপারেলস লিমিটেডে প্লেইন ও ওভারলক মেশিনে অপারেটর হিসেবে কাজ করেছি..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: WORKER PHOTO & DIGITAL SIGNATURE */}
            <div>
              <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-200">
                <span className="w-6 h-6 rounded-lg bg-purple-600 text-white font-bold text-xs flex items-center justify-center">৩</span>
                <h3 className="font-bold text-sm text-slate-900">
                  শ্রমিকের ছবি ও ডিজিটাল স্বাক্ষর
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* 1. Worker Photo Upload */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center">
                  <span className="font-bold text-slate-800 mb-2 block">
                    শ্রমিকের পাসপোর্ট সাইজ ছবি
                  </span>
                  
                  <div className="w-32 h-36 rounded-xl border-2 border-dashed border-slate-300 bg-white overflow-hidden flex items-center justify-center mb-3 relative shadow-inner">
                    {photoUrl ? (
                      <img src={photoUrl} alt="Applicant" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-slate-400 p-2 text-center">
                        <Camera className="w-8 h-8 mx-auto mb-1 opacity-60" />
                        <span className="text-[10px] block">ছবি সিলেক্ট করুন</span>
                      </div>
                    )}
                  </div>

                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{photoUrl ? 'ছবি পরিবর্তন' : 'ছবি আপলোড করুন'}</span>
                    </button>
                    {photoUrl && (
                      <button
                        type="button"
                        onClick={() => setPhotoUrl('')}
                        className="px-2.5 py-1.5 rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                      >
                        মুছুন
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1.5">
                    মোবাইল ক্যামেরা বা গ্যালারি থেকে সিলেক্ট করুন
                  </span>
                </div>

                {/* 2. Worker Digital Signature */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-800">
                        শ্রমিকের ডিজিটাল স্বাক্ষর (Digital Signature)
                      </span>
                      {/* Mode Toggle */}
                      <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setSignatureMode('pad')}
                          className={`px-2 py-0.5 rounded-md cursor-pointer ${
                            signatureMode === 'pad' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                          }`}
                        >
                          প্যাডে সই
                        </button>
                        <button
                          type="button"
                          onClick={() => setSignatureMode('upload')}
                          className={`px-2 py-0.5 rounded-md cursor-pointer ${
                            signatureMode === 'upload' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                          }`}
                        >
                          ফাইল আপলোড
                        </button>
                      </div>
                    </div>

                    {signatureMode === 'pad' ? (
                      /* Canvas Drawing Pad */
                      <div className="space-y-2">
                        <div className="border-2 border-slate-300 rounded-xl bg-white overflow-hidden shadow-inner touch-none relative">
                          <canvas
                            ref={sigCanvasRef}
                            width={340}
                            height={120}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                            className="w-full h-28 bg-white cursor-crosshair block"
                          />
                          {!signatureUrl && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-xs font-medium">
                              <PenTool className="w-3.5 h-3.5 mr-1" />
                              স্ক্রিনে আঙুল বা মাউস দিয়ে স্বাক্ষর করুন
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-slate-500">কালি: নীল (Blue Ink)</span>
                          <button
                            type="button"
                            onClick={clearCanvas}
                            className="text-xs text-rose-600 hover:text-rose-700 font-bold px-2 py-1 rounded bg-rose-50 border border-rose-200 cursor-pointer"
                          >
                            মুছে নতুন সই করুন
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* File Upload for Signature */
                      <div className="text-center py-3">
                        <div className="w-full h-24 border-2 border-dashed border-slate-300 rounded-xl bg-white flex items-center justify-center p-2 mb-2">
                          {signatureUrl ? (
                            <img src={signatureUrl} alt="Signature" className="max-h-20 object-contain" />
                          ) : (
                            <span className="text-slate-400 text-xs">স্বাক্ষরের ছবি নির্বাচন করুন</span>
                          )}
                        </div>
                        <input
                          ref={signatureInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleSignatureFileUpload}
                        />
                        <button
                          type="button"
                          onClick={() => signatureInputRef.current?.click()}
                          className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>কাগজে করা সইয়ের ছবি আপলোড</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 4: GUARDIAN / NOMINEE INFO & PHOTO */}
            <div>
              <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-200">
                <span className="w-6 h-6 rounded-lg bg-teal-600 text-white font-bold text-xs flex items-center justify-center">৪</span>
                <h3 className="font-bold text-sm text-slate-900">
                  অভিভাবক / নমিনির সকল তথ্য ও ছবি (জরুরি যোগাযোগের জন্য)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
                {/* Guardian Name */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    অভিভাবকের নাম <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    placeholder="যেমন: মোঃ জাহাঙ্গীর আলম"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>

                {/* Guardian Relation */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    সম্পর্ক <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={guardianRelation}
                    onChange={(e) => setGuardianRelation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                  >
                    <option value="স্বামী">স্বামী (Husband)</option>
                    <option value="স্ত্রী">স্ত্রী (Wife)</option>
                    <option value="পিতা">পিতা (Father)</option>
                    <option value="মাতা">মাতা (Mother)</option>
                    <option value="ভাই">ভাই (Brother)</option>
                    <option value="বোন">বোন (Sister)</option>
                    <option value="আইনগত অভিভাবক">অন্যান্য অভিভাবক</option>
                  </select>
                </div>

                {/* Guardian Mobile */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    অভিভাবকের মোবাইল নম্বর <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={guardianMobile}
                    onChange={(e) => setGuardianMobile(e.target.value)}
                    placeholder="018xxxxxxxx"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>

                {/* Guardian NID */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    অভিভাবকের NID নম্বর (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={guardianNid}
                    onChange={(e) => setGuardianNid(e.target.value)}
                    placeholder="জাতীয় পরিচয়পত্র নম্বর"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>

                {/* Guardian Address */}
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-800 mb-1">
                    অভিভাবকের বর্তমান ঠিকানা
                  </label>
                  <input
                    type="text"
                    value={guardianAddress}
                    onChange={(e) => setGuardianAddress(e.target.value)}
                    placeholder="খালি রাখলে আবেদনকারীর বর্তমান ঠিকানা গণ্য হবে"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>

                {/* Guardian Photo Upload */}
                <div className="sm:col-span-3 p-3 bg-teal-50/60 border border-teal-200 rounded-xl flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-18 rounded-lg bg-white border border-teal-300 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                      {guardianPhotoUrl ? (
                        <img src={guardianPhotoUrl} alt="Guardian" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-6 h-6 text-teal-400" />
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">অভিভাবকের ছবি</span>
                      <span className="text-[11px] text-slate-600 block">
                        শ্রমিকের অভিভাবক বা নমিনির ছবি সংযুক্ত করুন
                      </span>
                    </div>
                  </div>

                  <input
                    ref={guardianPhotoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleGuardianPhotoUpload}
                  />

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => guardianPhotoInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition active:scale-95"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{guardianPhotoUrl ? 'ছবি পরিবর্তন' : 'অভিভাবকের ছবি আপলোড'}</span>
                    </button>
                    {guardianPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setGuardianPhotoUrl('')}
                        className="px-2 py-1 rounded-lg border border-rose-300 text-rose-600 text-xs font-semibold hover:bg-rose-50"
                      >
                        মুছুন
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 5: BANK / MOBILE BANKING (OPTIONAL) */}
            <div>
              <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-200">
                <span className="w-6 h-6 rounded-lg bg-amber-600 text-white font-bold text-xs flex items-center justify-center">৫</span>
                <h3 className="font-bold text-sm text-slate-900">
                  বেতন পরিশোধের ব্যাংক / মোবাইল ব্যাংকিং (বিকাশ/নগদ/রকেট - ঐচ্ছিক)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    ব্যাংক বা ওয়ালেট নাম
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="যেমন: বিকাশ / নগদ / ডাচ বাংলা ব্যাংক"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    হিসাব বা ওয়ালেট নম্বর
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="01xxxxxxxx (নম্বর)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 6: DECLARATION & CONSENT */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <label className="flex items-start gap-3 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  required
                  checked={declarationAgreed}
                  onChange={(e) => setDeclarationAgreed(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-0 cursor-pointer w-4 h-4"
                />
                <span className="text-slate-800 leading-relaxed font-medium">
                  <b>অঙ্গীকারনামা:</b> আমি শপথপূর্বক অঙ্গীকার করছি যে, অত্র আবেদনপত্রে আমার নাম, পিতা ও মাতার নাম, বয়স, জাতীয় পরিচয়পত্র ও অন্যান্য যে সকল বিবরণ ও তথ্যাদি প্রদান করা হয়েছে তাহা সম্পূর্ণ সত্য ও সঠিক। কোনো অসত্য বা তথ্য গোপন করা প্রমাণিত হইলে কারখানা কর্তৃপক্ষ বিনা নোটিশে আমার আবেদন বা চাকরি বাতিল করিতে পারিবেন।
                </span>
              </label>
            </div>

            {/* ACTION BUTTONS: PREVIEW & SUBMIT */}
            <div className="pt-2 space-y-2">
              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  type="button"
                  onClick={handlePreviewClick}
                  className="w-full sm:w-auto px-4 py-3.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition active:scale-[0.99] cursor-pointer"
                  title="আবেদন ফরমের প্রিভিউ দেখুন ও A4 সাইজে প্রিন্ট/PDF করুন"
                >
                  <Eye className="w-4 h-4 text-indigo-600" />
                  <span>আবেদন প্রিভিউ ও A4 প্রিন্ট / PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsBlankModalOpen(true)}
                  className="w-full sm:w-auto px-4 py-3.5 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition active:scale-[0.99] cursor-pointer"
                  title="হাতে কলমে পূরণের জন্য ফাঁকা ফরম প্রিন্ট বা PDF ডাউনলোড করুন"
                >
                  <FileText className="w-4 h-4 text-amber-600" />
                  <span>ফাঁকা ফরম (হাতে পূরণের জন্য)</span>
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition active:scale-[0.99] cursor-pointer disabled:opacity-60"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>{isSubmitting ? 'আবেদন জমা হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...' : 'চাকরির আবেদন জমা দিন (Submit Application)'}</span>
                </button>
              </div>
              <p className="text-[11px] text-center text-slate-500">
                আবেদন জমা দেওয়ার পূর্বে "প্রিভিউ" বাটনে ক্লিক করে পুরো A4 ফরমটি দেখে নিতে ও প্রিন্ট করতে পারবেন।
              </p>
            </div>
          </div>
        </form>
      )}

      {/* Printable Modal (If requested after submission) */}
      {submittedApp && (
        <JobApplicationPrintModal
          application={submittedApp}
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          factory={factory}
          showToast={showToast}
          onOpenBlankForm={() => setIsBlankModalOpen(true)}
        />
      )}

      {/* Draft Preview Modal (Before submission) */}
      {previewDraftApp && (
        <JobApplicationPrintModal
          application={previewDraftApp}
          isOpen={Boolean(previewDraftApp)}
          onClose={() => setPreviewDraftApp(null)}
          factory={factory}
          showToast={showToast}
          isDraftPreview={true}
          onOpenBlankForm={() => setIsBlankModalOpen(true)}
        />
      )}

      {/* Blank Hand-filling Application Form Modal */}
      {isBlankModalOpen && (
        <BlankJobApplicationModal
          isOpen={isBlankModalOpen}
          onClose={() => setIsBlankModalOpen(false)}
          factory={factory}
          showToast={showToast}
        />
      )}
    </div>
  );
};
