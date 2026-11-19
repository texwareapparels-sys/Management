import React, { useState, useRef, useEffect } from 'react';
import { Employee } from '../types';
import { updateWorkerSelfProfile } from '../lib/firebase';
import { toBengaliNumber, formatDateBn } from '../lib/utils';
import {
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Camera,
  Upload,
  PenTool,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  X,
  Info,
  Calendar,
  Sparkles,
  User,
  FileCheck
} from 'lucide-react';

interface WorkerProfileSettingsProps {
  employee: Employee;
  onProfileUpdated: (updatedEmployee: Employee) => void;
  showToast: (msg: string) => void;
  onBackToAttendance?: () => void;
}

const BENGALI_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

/**
 * Resize and compress image using client-side canvas
 */
function compressImage(file: File, maxWidth = 500, maxHeight = 500, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Resize and compress signature image (transparent PNG or clean JPEG)
 */
function compressSignature(file: File, maxWidth = 600, maxHeight = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const WorkerProfileSettings: React.FC<WorkerProfileSettingsProps> = ({
  employee,
  onProfileUpdated,
  showToast,
  onBackToAttendance,
}) => {
  const currentDate = new Date();
  const currentMonthIdx = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const currentMonthKey = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}`;
  const currentMonthBn = `${BENGALI_MONTHS[currentMonthIdx]} ${toBengaliNumber(currentYear)}`;

  // Monthly policy: once per calendar month
  const alreadyUpdatedThisMonth = employee.lastProfileUpdateMonth === currentMonthKey;

  // Form states
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Photo state
  const [photoPreview, setPhotoPreview] = useState<string>(employee.photoUrl || '');
  const [hasNewPhoto, setHasNewPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Signature state: draw vs upload
  const [signatureMode, setSignatureMode] = useState<'upload' | 'draw'>('upload');
  const [signaturePreview, setSignaturePreview] = useState<string>(employee.signatureUrl || '');
  const [hasNewSignature, setHasNewSignature] = useState(false);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  // Signature Canvas Drawing
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnOnCanvas, setHasDrawnOnCanvas] = useState(false);

  // UI state
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Set up canvas for drawing
  useEffect(() => {
    if (signatureMode === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [signatureMode]);

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawnOnCanvas(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
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
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      setSignaturePreview(dataUrl);
      setHasNewSignature(true);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnOnCanvas(false);
    setSignaturePreview(employee.signatureUrl || '');
    setHasNewSignature(false);
  };

  // Handle Photo File Upload
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage('');

    try {
      const compressed = await compressImage(file, 500, 500, 0.85);
      setPhotoPreview(compressed);
      setHasNewPhoto(true);
      showToast('ছবি সফলভাবে লোড হয়েছে। সংরক্ষণে চাপুন।');
    } catch {
      setErrorMessage('ছবি প্রসেসিং করতে সমস্যা হয়েছে। অন্য একটি ছবি নির্বাচন করুন।');
    }
  };

  // Handle Signature File Upload
  const handleSignatureSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage('');

    try {
      const compressed = await compressSignature(file, 600, 300);
      setSignaturePreview(compressed);
      setHasNewSignature(true);
      showToast('স্বাক্ষর সফলভাবে লোড হয়েছে। সংরক্ষণে চাপুন।');
    } catch {
      setErrorMessage('স্বাক্ষর প্রসেসিং করতে সমস্যা হয়েছে। অন্য একটি ফাইল নির্বাচন করুন।');
    }
  };

  // Validate old password
  const verifyOldPassword = (inputPass: string): boolean => {
    const cleanInput = inputPass.trim();
    if (!cleanInput) return false;

    const mobileDigits = (employee.mobile || '').replace(/[^0-9]/g, '');
    const defaultLast4 = mobileDigits.slice(-4);
    const workerIdCode = (employee.workerId || '').toLowerCase();

    // 1. If portalPassword explicitly set
    if (employee.portalPassword) {
      return employee.portalPassword === cleanInput;
    }

    // 2. Default checks: last 4 digits of mobile, or '123456', or workerId
    return (
      cleanInput === defaultLast4 ||
      cleanInput === '123456' ||
      cleanInput === workerIdCode ||
      cleanInput === '123456'
    );
  };

  // Handle Form Submission Step 1: Validation
  const handleInitiateSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (alreadyUpdatedThisMonth) {
      setErrorMessage(
        `কারখানার নীতিমালা অনুযায়ী আপনি চলতি মাসে (${currentMonthBn}) ইতোমধ্যে একবার প্রোফাইল আপডেট করেছেন। প্রতি মাসে একবার মাত্র পরিবর্তন করা যায়।`
      );
      return;
    }

    // 1. Verify Current Password
    if (!currentPasswordInput.trim()) {
      setErrorMessage('নিরাপত্তা নিশ্চিত করতে অনুগ্রহ করে আপনার বর্তমান (আগেকার) পাসওয়ার্ড প্রদান করুন।');
      return;
    }

    if (!verifyOldPassword(currentPasswordInput)) {
      setErrorMessage('বর্তমান (আগেকার) পাসওয়ার্ডটি সঠিক নয়! দয়া করে সঠিক পাসওয়ার্ড দিন অথবা কারখানা অ্যাডমিনের সাহায্য নিন।');
      return;
    }

    // 2. Check if at least one change is made
    const willChangePassword = Boolean(newPassword.trim());
    if (!willChangePassword && !hasNewPhoto && !hasNewSignature) {
      setErrorMessage('আপনি কোনো তথ্য পরিবর্তন করেননি। নতুন পাসওয়ার্ড, ছবি অথবা স্বাক্ষরের মধ্যে যেকোনো একটি পরিবর্তন করুন।');
      return;
    }

    // 3. New password checks if provided
    if (willChangePassword) {
      if (newPassword.trim().length < 4) {
        setErrorMessage('নতুন পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।');
        return;
      }
      if (newPassword.trim() !== confirmPassword.trim()) {
        setErrorMessage('নতুন পাসওয়ার্ড এবং নিশ্চিতকরণ পাসওয়ার্ড মিলছে না!');
        return;
      }
    }

    // Everything is valid -> show confirmation modal
    setShowConfirmModal(true);
  };

  // Step 2: Final Commit to Firebase and Local State
  const handleConfirmAndSave = async () => {
    setIsSaving(true);
    setErrorMessage('');

    try {
      const updates: Partial<Employee> = {
        lastProfileUpdateMonth: currentMonthKey,
        lastProfileUpdatedAt: Date.now(),
      };

      if (newPassword.trim()) {
        updates.portalPassword = newPassword.trim();
      }
      if (hasNewPhoto && photoPreview) {
        updates.photoUrl = photoPreview;
      }
      if (hasNewSignature && signaturePreview) {
        updates.signatureUrl = signaturePreview;
      }

      // Update in Firebase and local list
      await updateWorkerSelfProfile(employee.id, updates);

      const updatedEmployee: Employee = {
        ...employee,
        ...updates,
      };

      // Update session in localStorage
      try {
        localStorage.setItem(
          'texware_worker_session',
          JSON.stringify({
            id: updatedEmployee.id,
            workerId: updatedEmployee.workerId,
            mobile: updatedEmployee.mobile,
            name: updatedEmployee.name,
          })
        );
      } catch {}

      onProfileUpdated(updatedEmployee);
      setShowConfirmModal(false);
      showToast('আপনার প্রোফাইল তথ্য ও পাসওয়ার্ড সফলভাবে আপডেট এবং অ্যাডমিন প্যানেলে সিঙ্ক হয়েছে!');

      // Reset form
      setCurrentPasswordInput('');
      setNewPassword('');
      setConfirmPassword('');
      setHasNewPhoto(false);
      setHasNewSignature(false);
    } catch (err: any) {
      setErrorMessage('সংরক্ষণে ত্রুটি হয়েছে: ' + (err?.message || 'অনুগ্রহ করে পুনরায় চেষ্টা করুন'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Navigation */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-white/10 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-base sm:text-lg font-black text-white">
                প্রোফাইল নিরাপত্তা ও সেটিংস
              </h2>
            </div>
            <p className="text-xs text-blue-200 mt-1">
              শ্রমিক তার ব্যক্তিগত পাসওয়ার্ড পরিবর্তন, ছবি ও ডিজিটাল স্বাক্ষর নিজে আপডেট করতে পারবেন
            </p>
          </div>

          {onBackToAttendance && (
            <button
              type="button"
              onClick={onBackToAttendance}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer transition border border-white/20"
            >
              <span>← হাজিরা ড্যাশবোর্ডে ফিরুন</span>
            </button>
          )}
        </div>
      </div>

      {/* Monthly Policy Card */}
      <div
        className={`p-4 rounded-2xl border transition-all ${
          alreadyUpdatedThisMonth
            ? 'bg-amber-50/80 border-amber-200 text-amber-950'
            : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
        }`}
      >
        <div className="flex items-start gap-3">
          {alreadyUpdatedThisMonth ? (
            <div className="w-9 h-9 rounded-xl bg-amber-200 border border-amber-300 flex items-center justify-center text-amber-800 shrink-0 mt-0.5">
              <Lock className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-emerald-200 border border-emerald-300 flex items-center justify-center text-emerald-800 shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
          )}
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-xs font-black">
                {alreadyUpdatedThisMonth
                  ? `🔒 চলতি মাসে (${currentMonthBn}) প্রোফাইল আপডেট সম্পন্ন হয়েছে`
                  : `✨ চলতি মাসের (${currentMonthBn}) পরিবর্তন সক্রিয়`}
              </h3>
              <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-white/80 border border-slate-300">
                মাসে ১ বার পরিবর্তন নীতি
              </span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {alreadyUpdatedThisMonth ? (
                <>
                  কারখানার নিরাপত্তা ও অডিট নীতিমালা অনুযায়ী একজন শ্রমিক প্রতি ক্যালেন্ডার মাসে একবার মাত্র পাসওয়ার্ড, ছবি ও স্বাক্ষর নিজে পরিবর্তন করতে পারেন। আপনি চলতি মাসে ইতোমধ্যে আপডেট করেছেন{' '}
                  {employee.lastProfileUpdatedAt ? (
                    <span className="font-bold font-mono">
                      (শেষ আপডেট: {formatDateBn(new Date(employee.lastProfileUpdatedAt).toISOString().split('T')[0])})
                    </span>
                  ) : null}
                  । পরবর্তী মাসে পুনরায় পরিবর্তন করতে পারবেন। জরুরি প্রয়োজনে কারখানার এইচআর বা অ্যাডমিন শাখায় যোগাযোগ করুন।
                </>
              ) : (
                <>
                  আপনি এই মাসে ({currentMonthBn}) ১ বার আপনার প্রোফাইল তথ্য (পাসওয়ার্ড, ছবি ও ডিজিটাল স্বাক্ষর) নিজে আপডেট করতে পারবেন। নিরাপত্তা নিশ্চিত করতে বর্তমান পাসওয়ার্ড দিয়ে পরিবর্তন করুন। সংরক্ষিত তথ্য সাথে সাথে অ্যাডমিন প্যানেলে সিঙ্ক হবে।
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Main Form or Locked View */}
      <form onSubmit={handleInitiateSave} className="space-y-4">
        {errorMessage && (
          <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl text-xs text-rose-800 flex items-start gap-2.5 shadow-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="font-bold flex-1">{errorMessage}</div>
          </div>
        )}

        {/* 1. Identity Verification (Old Password) */}
        {!alreadyUpdatedThisMonth && (
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <KeyRound className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-black text-slate-800">১. বর্তমান পাসওয়ার্ড যাচাইকরণ (বাধ্যতামূলক)</h3>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                আপনার আগেকার / বর্তমান পাসওয়ার্ড *
              </label>
              <div className="relative max-w-md">
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  required
                  value={currentPasswordInput}
                  onChange={(e) => setCurrentPasswordInput(e.target.value)}
                  placeholder="বর্তমান পাসওয়ার্ড লিখুন (যেমন: 123456 বা মোবাইলের শেষ ৪ সংখ্যা)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="p-1 text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                >
                  {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                যেকোনো তথ্য পরিবর্তনের পূর্বে বর্তমান পাসওয়ার্ড দিয়ে পরিচয় নিশ্চিত করতে হবে।
              </span>
            </div>
          </div>
        )}

        {/* 2. Change Password Section */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-black text-slate-800">২. নতুন পাসওয়ার্ড নির্ধারণ (ঐচ্ছিক)</h3>
            </div>
            {alreadyUpdatedThisMonth && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                লক রয়েছে
              </span>
            )}
          </div>

          {alreadyUpdatedThisMonth ? (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <span>বর্তমান সক্রিয় পাসওয়ার্ড:</span>
              <span className="font-mono font-bold tracking-widest text-slate-800">••••••••</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  নতুন পাসওয়ার্ড লিখুন
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="কমপক্ষে ৪ অক্ষরের পাসওয়ার্ড"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="p-1 text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  নতুন পাসওয়ার্ড নিশ্চিত করুন
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="পুনরায় নতুন পাসওয়ার্ড লিখুন"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="p-1 text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}
          <span className="text-[10px] text-slate-500 block">
            পাসওয়ার্ড পরিবর্তন করতে না চাইলে এই দুটি ঘর খালি রাখুন।
          </span>
        </div>

        {/* 3. Profile Photo Section */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-black text-slate-800">৩. প্রোফাইল ছবি পরিবর্তন</h3>
            </div>
            {hasNewPhoto && (
              <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                নতুন ছবি নির্বাচিত
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            {/* Photo Preview */}
            <div className="w-24 h-32 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 overflow-hidden shrink-0 flex items-center justify-center relative shadow-inner group">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt={employee.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-10 h-10 text-slate-400" />
              )}
            </div>

            <div className="space-y-2 text-center sm:text-left flex-1">
              <p className="text-xs text-slate-600">
                স্পষ্ট পাসপোর্ট সাইজের ছবি আপলোড করুন। এটি আইডি কার্ড, হাজিরা রেজিস্টার এবং অ্যাডমিন প্যানেলে প্রদর্শিত হবে।
              </p>

              {!alreadyUpdatedThisMonth ? (
                <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start pt-1">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition active:scale-95"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>নতুন ছবি নির্বাচন করুন</span>
                  </button>

                  {hasNewPhoto && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoPreview(employee.photoUrl || '');
                        setHasNewPhoto(false);
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer transition"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>বাতিল করুন</span>
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-[11px] text-amber-700 font-bold block pt-1">
                  🔒 চলতি মাসে ছবি পরিবর্তন সীমা অতিক্রান্ত হয়েছে।
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 4. Digital Signature Section (Upload or Draw) */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <PenTool className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-black text-slate-800">৪. ডিজিটাল স্বাক্ষর (Signature)</h3>
            </div>
            {hasNewSignature && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                নতুন স্বাক্ষর রেডি
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600">
            শ্রমিকের এই ডিজিটাল স্বাক্ষর চাকরির চুক্তিপত্র, পদত্যাগপত্র ও অন্যান্য প্রাতিষ্ঠানিক নথিতে ব্যবহৃত হবে।
          </p>

          {!alreadyUpdatedThisMonth ? (
            <div className="space-y-3">
              {/* Mode Toggle: Draw vs Upload */}
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl max-w-xs">
                <button
                  type="button"
                  onClick={() => setSignatureMode('upload')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                    signatureMode === 'upload'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ছবি আপলোড
                </button>
                <button
                  type="button"
                  onClick={() => setSignatureMode('draw')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                    signatureMode === 'draw'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  স্ক্রিনে আঁকুন (Draw)
                </button>
              </div>

              {signatureMode === 'upload' ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    ref={signatureInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleSignatureSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => signatureInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition active:scale-95"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>স্বাক্ষরের ফাইল আপলোড</span>
                  </button>

                  {hasNewSignature && (
                    <button
                      type="button"
                      onClick={() => {
                        setSignaturePreview(employee.signatureUrl || '');
                        setHasNewSignature(false);
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer transition"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>রিসেট</span>
                    </button>
                  )}
                </div>
              ) : (
                /* Canvas Draw Pad */
                <div className="space-y-2">
                  <div className="border-2 border-dashed border-slate-300 rounded-xl bg-white p-2 max-w-md shadow-xs">
                    <canvas
                      ref={canvasRef}
                      width={380}
                      height={140}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-28 touch-none bg-slate-50 rounded-lg cursor-crosshair border border-slate-200"
                    />
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400">
                        মাউস বা আঙুল দিয়ে বক্সের ভেতর স্বাক্ষর করুন
                      </span>
                      <button
                        type="button"
                        onClick={clearCanvas}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer transition"
                      >
                        ক্লিয়ার (মুছুন)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-amber-700 font-bold block">
              🔒 চলতি মাসে স্বাক্ষর পরিবর্তন সীমা অতিক্রান্ত হয়েছে।
            </span>
          )}

          {/* Current / New Signature Preview */}
          {signaturePreview ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl max-w-sm">
              <span className="text-[10px] font-bold text-slate-500 block mb-1">
                {hasNewSignature ? 'নতুন স্বাক্ষর প্রিভিউ:' : 'বর্তমান ডিজিটাল স্বাক্ষর:'}
              </span>
              <div className="h-16 bg-white border border-slate-200 rounded-lg flex items-center justify-center p-1">
                <img
                  src={signaturePreview}
                  alt="Worker Signature"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 italic">
              কোনো ডিজিটাল স্বাক্ষর আপলোড করা নেই।
            </div>
          )}
        </div>

        {/* Submit Actions */}
        {!alreadyUpdatedThisMonth ? (
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition active:scale-95 disabled:opacity-50"
            >
              <FileCheck className="w-4 h-4" />
              <span>পরিবর্তন সংরক্ষণ ও অ্যাডমিন প্যানেলে সিঙ্ক করুন</span>
            </button>
            <p className="text-[11px] text-slate-500 mt-2">
              ⚠️ মনে রাখবেন: সংরক্ষণে চাপ দিলে এই মাসে এটি আর পুনরায় পরিবর্তন করা যাবে না।
            </p>
          </div>
        ) : (
          <div className="p-3 bg-slate-100 rounded-xl text-center text-xs font-bold text-slate-600">
            🔒 পরবর্তী মাসের ১ তারিখ থেকে পুনরায় প্রোফাইল তথ্য পরিবর্তন করতে পারবেন।
          </div>
        )}
      </form>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-sm font-black text-slate-900">
                আপনি কি নিশ্চিত যে প্রোফাইল তথ্য সংরক্ষণ করবেন?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                কারখানার নিয়ম অনুযায়ী আপনি <b>প্রতি মাসে একবার মাত্র</b> নিজে প্রোফাইল পরিবর্তন করতে পারবেন। সংরক্ষণের সাথে সাথেই নতুন তথ্য কারখানা অ্যাডমিন প্যানেলে রিয়েলটাইমে আপডেট হবে।
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">পাসওয়ার্ড পরিবর্তন:</span>
                <span className="font-bold text-slate-800">
                  {newPassword.trim() ? 'হ্যাঁ (নতুন পাসওয়ার্ড দেওয়া হয়েছে)' : 'না (অপরিবর্তিত)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">নতুন ছবি:</span>
                <span className="font-bold text-slate-800">
                  {hasNewPhoto ? 'হ্যাঁ (নতুন ছবি দেওয়া হয়েছে)' : 'না (অপরিবর্তিত)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">নতুন স্বাক্ষর:</span>
                <span className="font-bold text-slate-800">
                  {hasNewSignature ? 'হ্যাঁ (নতুন স্বাক্ষর প্রস্তুত)' : 'না (অপরিবর্তিত)'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleConfirmAndSave}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>সিঙ্ক হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>হ্যাঁ, চূড়ান্ত সংরক্ষণ করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
