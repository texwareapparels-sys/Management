import React, { useState, useRef, useEffect } from 'react';
import { JobApplication } from '../types';
import { updateJobApplication } from '../lib/firebase';
import { compressImageFile, compressSignatureImage } from '../lib/imageUtils';
import {
  X,
  Save,
  Loader2,
  Camera,
  Upload,
  PenTool,
  User,
  Pencil,
} from 'lucide-react';

interface JobApplicationEditModalProps {
  application: JobApplication | null;
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
  onSuccess?: (updatedApp: JobApplication) => void;
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

const GUARDIAN_RELATIONS = [
  { value: 'স্বামী', label: 'স্বামী (Husband)' },
  { value: 'স্ত্রী', label: 'স্ত্রী (Wife)' },
  { value: 'পিতা', label: 'পিতা (Father)' },
  { value: 'মাতা', label: 'মাতা (Mother)' },
  { value: 'ভাই', label: 'ভাই (Brother)' },
  { value: 'বোন', label: 'বোন (Sister)' },
  { value: 'আইনগত অভিভাবক', label: 'অন্যান্য অভিভাবক' },
];

export const JobApplicationEditModal: React.FC<JobApplicationEditModalProps> = ({
  application,
  isOpen,
  onClose,
  showToast,
  onSuccess,
}) => {
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
  const [expectedSalary, setExpectedSalary] = useState('');
  const [experience, setExperience] = useState('');
  const [education, setEducation] = useState('');

  const [photoUrl, setPhotoUrl] = useState('');
  const [signatureUrl, setSignatureUrl] = useState('');
  const [signatureMode, setSignatureMode] = useState<'upload' | 'pad'>('upload');
  const [isDrawing, setIsDrawing] = useState(false);

  const [guardianName, setGuardianName] = useState('');
  const [guardianRelation, setGuardianRelation] = useState('স্বামী');
  const [guardianMobile, setGuardianMobile] = useState('');
  const [guardianNid, setGuardianNid] = useState('');
  const [guardianAddress, setGuardianAddress] = useState('');
  const [guardianPhotoUrl, setGuardianPhotoUrl] = useState('');

  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const guardianPhotoInputRef = useRef<HTMLInputElement>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!application || !isOpen) return;

    setName(application.name || '');
    setNameEn(application.nameEn || '');
    setFatherName(application.fatherName || '');
    setMotherName(application.motherName || '');
    setNid(application.nid || '');
    setBirthDate(application.birthDate || '');
    setAge(application.age ?? '');
    setGender(application.gender || 'female');
    setMaritalStatus(application.maritalStatus || 'married');
    setBloodGroup(application.bloodGroup || '');
    setMobile(application.mobile || '');
    setAltMobile(application.altMobile || '');

    const pres = application.presentAddress || '';
    const perm = application.permanentAddress || '';
    setPresentAddress(pres);
    setPermanentAddress(perm);
    setSameAsPresent(Boolean(pres && perm && pres.trim() === perm.trim()));

    const existingDesig = application.appliedDesignation || COMMON_GARMENT_POSITIONS[0];
    if (COMMON_GARMENT_POSITIONS.includes(existingDesig) && existingDesig !== 'অন্যান্য পদ') {
      setAppliedDesignation(existingDesig);
      setCustomDesignation('');
    } else if (existingDesig === 'অন্যান্য পদ') {
      setAppliedDesignation('অন্যান্য পদ');
      setCustomDesignation('');
    } else {
      setAppliedDesignation('অন্যান্য পদ');
      setCustomDesignation(existingDesig);
    }

    setDepartment(application.department || GARMENT_DEPARTMENTS[0]);
    setExpectedSalary(application.expectedSalary ? String(application.expectedSalary) : '');
    setExperience(application.experience || '');
    setEducation(application.education || '');

    setPhotoUrl(application.photoUrl || '');
    setSignatureUrl(application.signatureUrl || '');
    setSignatureMode('upload');

    setGuardianName(application.guardianName || '');
    setGuardianRelation(application.guardianRelation || 'স্বামী');
    setGuardianMobile(application.guardianMobile || '');
    setGuardianNid(application.guardianNid || '');
    setGuardianAddress(application.guardianAddress || '');
    setGuardianPhotoUrl(application.guardianPhotoUrl || '');

    setBankName(application.bankName || '');
    setAccountNumber(application.accountNumber || '');
  }, [application, isOpen]);

  if (!isOpen || !application) return null;

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

  const handleSameAddressToggle = (checked: boolean) => {
    setSameAsPresent(checked);
    if (checked) {
      setPermanentAddress(presentAddress);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 480, 480, 0.82);
      setPhotoUrl(compressed);
      showToast('শ্রমিকের ছবি সফলভাবে আপডেট হয়েছে');
    } catch {
      showToast('ছবি প্রসেস করতে ব্যর্থ হয়েছে');
    }
  };

  const handleGuardianPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 480, 480, 0.82);
      setGuardianPhotoUrl(compressed);
      showToast('অভিভাবকের ছবি সফলভাবে আপডেট হয়েছে');
    } catch {
      showToast('ছবি প্রসেস করতে ব্যর্থ হয়েছে');
    }
  };

  const handleSignatureFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressSignatureImage(file, 400, 150);
      setSignatureUrl(compressed);
      showToast('স্বাক্ষরের ছবি সফলভাবে আপডেট হয়েছে');
    } catch {
      showToast('স্বাক্ষর প্রসেস করতে ব্যর্থ হয়েছে');
    }
  };

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
    ctx.strokeStyle = '#0f2963';
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
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setSignatureUrl('');
  };

  const handleSave = async (e: React.FormEvent) => {
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

    const finalDesignation =
      appliedDesignation === 'অন্যান্য পদ' && customDesignation.trim()
        ? customDesignation.trim()
        : appliedDesignation;

    if (!finalDesignation.trim() || finalDesignation === 'অন্যান্য পদ') {
      if (appliedDesignation === 'অন্যান্য পদ' && !customDesignation.trim()) {
        showToast('নির্দিষ্ট পদের নাম লিখুন');
        return;
      }
    }

    setIsSaving(true);
    try {
      const parsedExpectedSalary =
        expectedSalary.trim() && !isNaN(Number(expectedSalary))
          ? Number(expectedSalary)
          : undefined;

      const updates: Partial<Omit<JobApplication, 'id' | 'createdAt'>> = {
        name: name.trim(),
        nameEn: nameEn.trim() || undefined,
        fatherName: fatherName.trim(),
        motherName: motherName.trim(),
        nid: nid.trim(),
        birthDate: birthDate,
        age: age ? Number(age) : undefined,
        gender,
        maritalStatus,
        bloodGroup: bloodGroup.trim() || undefined,
        mobile: mobile.trim(),
        altMobile: altMobile.trim() || undefined,
        presentAddress: presentAddress.trim(),
        permanentAddress: (sameAsPresent ? presentAddress : permanentAddress).trim() || presentAddress.trim(),
        appliedDesignation: finalDesignation,
        department: department.trim() || undefined,
        expectedSalary: parsedExpectedSalary,
        experience: experience.trim() || undefined,
        education: education.trim() || undefined,
        photoUrl: photoUrl || '',
        signatureUrl: signatureUrl || '',
        guardianName: guardianName.trim(),
        guardianRelation: guardianRelation.trim(),
        guardianNid: guardianNid.trim() || undefined,
        guardianMobile: guardianMobile.trim(),
        guardianAddress: guardianAddress.trim() || presentAddress.trim(),
        guardianPhotoUrl: guardianPhotoUrl || '',
        bankName: bankName.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
      };

      const updated = await updateJobApplication(application.id, updates);
      showToast(`✓ আবেদনপত্র (${application.applicationNo}) সফলভাবে আপডেট করা হয়েছে`);
      if (updated) {
        onSuccess?.(updated);
      }
      onClose();
    } catch (err) {
      console.error('Failed to update job application:', err);
      showToast('আবেদনপত্র আপডেট করতে সমস্যা হয়েছে');
    } finally {
      setIsSaving(false);
    }
  };

  const departmentOptions = GARMENT_DEPARTMENTS.includes(department) || !department
    ? GARMENT_DEPARTMENTS
    : [department, ...GARMENT_DEPARTMENTS];

  const relationOptions = GUARDIAN_RELATIONS.some((r) => r.value === guardianRelation) || !guardianRelation
    ? GUARDIAN_RELATIONS
    : [{ value: guardianRelation, label: guardianRelation }, ...GUARDIAN_RELATIONS];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[95vh] my-auto overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">
                  আবেদনপত্র এডিট / সংশোধন করুন
                </h3>
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  {application.applicationNo}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                প্রার্থী: <b className="text-white">{application.name}</b> — প্রয়োজনীয় তথ্য সংশোধন করে সেভ করুন
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            title="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* SECTION 1: PERSONAL INFO */}
          <div>
            <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-200">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">১</span>
              <h4 className="font-bold text-sm text-slate-900">
                আবেদনকারীর ব্যক্তিগত তথ্য ও ঠিকানা
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  আবেদনকারীর নাম (বাংলায়) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Name in English (Block Letters)
                </label>
                <input
                  type="text"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  পিতার নাম <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  মাতার নাম <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={motherName}
                  onChange={(e) => setMotherName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  জাতীয় পরিচয়পত্র (NID) বা জন্ম নিবন্ধন নং <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nid}
                  onChange={(e) => setNid(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

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

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  মোবাইল নম্বর <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  বিকল্প মোবাইল নম্বর
                </label>
                <input
                  type="tel"
                  value={altMobile}
                  onChange={(e) => setAltMobile(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

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
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: APPLIED POSITION & EXPERIENCE */}
          <div>
            <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-200">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">২</span>
              <h4 className="font-bold text-sm text-slate-900">
                আবেদনকৃত পদ ও যোগ্যতার বিবরণ
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
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

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  পছন্দনীয় সেকশন / বিভাগ
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {departmentOptions.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  প্রত্যাশিত বেতন (ঐচ্ছিক)
                </label>
                <input
                  type="number"
                  min={0}
                  value={expectedSalary}
                  onChange={(e) => setExpectedSalary(e.target.value)}
                  placeholder="যেমন: 12500"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="sm:col-span-2 md:col-span-3">
                <label className="block font-bold text-slate-800 mb-1">
                  কাজের অভিজ্ঞতা
                </label>
                <textarea
                  rows={2}
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: PHOTO & SIGNATURE */}
          <div>
            <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-200">
              <span className="w-6 h-6 rounded-lg bg-purple-600 text-white font-bold text-xs flex items-center justify-center">৩</span>
              <h4 className="font-bold text-sm text-slate-900">
                শ্রমিকের ছবি ও ডিজিটাল স্বাক্ষর
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Applicant Photo */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center">
                <span className="font-bold text-slate-800 mb-2 block">
                  শ্রমিকের পাসপোর্ট সাইজ ছবি
                </span>
                <div className="w-28 h-32 rounded-xl border-2 border-dashed border-slate-300 bg-white overflow-hidden flex items-center justify-center mb-3 shadow-inner">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Applicant" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-slate-400 p-2 text-center">
                      <Camera className="w-7 h-7 mx-auto mb-1 opacity-60" />
                      <span className="text-[10px] block">ছবি নেই</span>
                    </div>
                  )}
                </div>

                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{photoUrl ? 'ছবি পরিবর্তন' : 'ছবি আপলোড'}</span>
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
              </div>

              {/* Signature */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-800">
                      শ্রমিকের ডিজিটাল স্বাক্ষর
                    </span>
                    <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setSignatureMode('upload')}
                        className={`px-2 py-0.5 rounded-md cursor-pointer ${
                          signatureMode === 'upload' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        ছবি আপলোড
                      </button>
                      <button
                        type="button"
                        onClick={() => setSignatureMode('pad')}
                        className={`px-2 py-0.5 rounded-md cursor-pointer ${
                          signatureMode === 'pad' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        প্যাডে সই
                      </button>
                    </div>
                  </div>

                  {signatureMode === 'upload' ? (
                    <div className="text-center py-2">
                      <div className="w-full h-24 border-2 border-dashed border-slate-300 rounded-xl bg-white flex items-center justify-center p-2 mb-2">
                        {signatureUrl ? (
                          <img src={signatureUrl} alt="Signature" className="max-h-20 object-contain" />
                        ) : (
                          <span className="text-slate-400 text-xs">কোনো স্বাক্ষর সংযুক্ত নেই</span>
                        )}
                      </div>
                      <input
                        ref={signatureInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleSignatureFileUpload}
                      />
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => signatureInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{signatureUrl ? 'স্বাক্ষর পরিবর্তন' : 'স্বাক্ষরের ছবি আপলোড'}</span>
                        </button>
                        {signatureUrl && (
                          <button
                            type="button"
                            onClick={() => setSignatureUrl('')}
                            className="px-2.5 py-1.5 rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                          >
                            মুছুন
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="border-2 border-slate-300 rounded-xl bg-white overflow-hidden shadow-inner touch-none relative">
                        <canvas
                          ref={sigCanvasRef}
                          width={340}
                          height={110}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                          className="w-full h-24 bg-white cursor-crosshair block"
                        />
                        {!signatureUrl && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-xs font-medium">
                            <PenTool className="w-3.5 h-3.5 mr-1" />
                            এখানে আঙুল বা মাউস দিয়ে নতুন সই করুন
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">সই করলে স্বয়ংক্রিয়ভাবে সেভ হবে</span>
                        <button
                          type="button"
                          onClick={clearCanvas}
                          className="text-xs text-rose-600 hover:text-rose-700 font-bold px-2 py-1 rounded bg-rose-50 border border-rose-200 cursor-pointer"
                        >
                          মুছে নতুন সই করুন
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: GUARDIAN / NOMINEE INFO */}
          <div>
            <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-200">
              <span className="w-6 h-6 rounded-lg bg-teal-600 text-white font-bold text-xs flex items-center justify-center">৪</span>
              <h4 className="font-bold text-sm text-slate-900">
                অভিভাবক / নমিনির তথ্য ও ছবি
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  অভিভাবকের নাম <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  সম্পর্ক <span className="text-rose-500">*</span>
                </label>
                <select
                  value={guardianRelation}
                  onChange={(e) => setGuardianRelation(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  {relationOptions.map((rel) => (
                    <option key={rel.value} value={rel.value}>{rel.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  অভিভাবকের মোবাইল নম্বর <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={guardianMobile}
                  onChange={(e) => setGuardianMobile(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  অভিভাবকের NID নম্বর (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={guardianNid}
                  onChange={(e) => setGuardianNid(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-800 mb-1">
                  অভিভাবকের বর্তমান ঠিকানা
                </label>
                <input
                  type="text"
                  value={guardianAddress}
                  onChange={(e) => setGuardianAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div className="sm:col-span-2 md:col-span-3 p-3 bg-teal-50/60 border border-teal-200 rounded-xl flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-16 rounded-lg bg-white border border-teal-300 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                    {guardianPhotoUrl ? (
                      <img src={guardianPhotoUrl} alt="Guardian" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-teal-400" />
                    )}
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block">অভিভাবকের ছবি</span>
                    <span className="text-[11px] text-slate-600 block">
                      অভিভাবক বা নমিনির ছবি পরিবর্তন বা যুক্ত করুন
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
                      className="px-2 py-1 rounded-lg border border-rose-300 text-rose-600 text-xs font-semibold hover:bg-rose-50 cursor-pointer"
                    >
                      মুছুন
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 5: BANK / MOBILE BANKING */}
          <div>
            <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-200">
              <span className="w-6 h-6 rounded-lg bg-amber-600 text-white font-bold text-xs flex items-center justify-center">৫</span>
              <h4 className="font-bold text-sm text-slate-900">
                বেতন পরিশোধের ব্যাংক / মোবাইল ব্যাংকিং (ঐচ্ছিক)
              </h4>
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

          {/* Modal Sticky Action Footer */}
          <div className="pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 sticky bottom-0 bg-white pb-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition cursor-pointer disabled:opacity-60"
            >
              বাতিল করুন
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>সেভ হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>পরিবর্তন সেভ করুন</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
