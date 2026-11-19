import React, { useState, useEffect } from 'react';
import { Employee } from '../types';
import {
  saveOrUpdateEmployee,
  blockEmployeeProfile,
  unblockEmployeeProfile,
  regenerateWorkerPortalLink,
  toggleWorkerPortalLink
} from '../lib/firebase';
import { formatMoney, formatDateBn } from '../lib/utils';
import { getWorkerLoginUrl, getWorkerCredentialsMessage } from '../lib/userAuthLinks';
import {
  X,
  Key,
  Link as LinkIcon,
  Copy,
  Check,
  Send,
  Phone,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink,
  MessageCircle,
  Share2,
  ShieldCheck,
  User,
  Sparkles,
  Info,
  Ban,
  ShieldAlert,
  Unlock,
  RotateCcw,
  KeyRound,
  ShieldOff,
  Power,
  AlertTriangle
} from 'lucide-react';

interface WorkerCredentialModalProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
}

export const WorkerCredentialModal: React.FC<WorkerCredentialModalProps> = ({
  employee,
  isOpen,
  onClose,
  showToast,
}) => {
  if (!isOpen || !employee) return null;

  const [mobile, setMobile] = useState(employee.mobile || '');
  const [password, setPassword] = useState(
    employee.portalPassword ||
    (employee.mobile ? employee.mobile.replace(/[^0-9]/g, '').slice(-4) : '123456')
  );
  const [showPassword, setShowPassword] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const [isBlocked, setIsBlocked] = useState(Boolean(employee.isBlocked));
  const [blockReason, setBlockReason] = useState(employee.blockReason || '');
  const [isUpdatingBlock, setIsUpdatingBlock] = useState(false);

  const [portalToken, setPortalToken] = useState(employee.portalToken || '');
  const [portalLinkEnabled, setPortalLinkEnabled] = useState(employee.portalLinkEnabled !== false);
  const [isRegeneratingLink, setIsRegeneratingLink] = useState(false);
  const [isTogglingLink, setIsTogglingLink] = useState(false);

  useEffect(() => {
    if (employee) {
      setMobile(employee.mobile || '');
      const defaultPass =
        employee.portalPassword ||
        (employee.mobile ? employee.mobile.replace(/[^0-9]/g, '').slice(-4) : '123456');
      setPassword(defaultPass || '123456');
      setIsBlocked(Boolean(employee.isBlocked));
      setBlockReason(employee.blockReason || '');
      setPortalToken(employee.portalToken || '');
      setPortalLinkEnabled(employee.portalLinkEnabled !== false);
    }
  }, [employee]);

  // Handle Block Worker Profile
  const handleBlockWorker = async () => {
    if (!blockReason.trim()) {
      showToast('অনুগ্রহ করে ব্লক করার সুনির্দিষ্ট কারণ লিখুন');
      return;
    }
    setIsUpdatingBlock(true);
    try {
      await blockEmployeeProfile(employee.id, blockReason.trim());
      setIsBlocked(true);
      showToast(`⛔ "${employee.name}" এর প্রোফাইল সফলভাবে ব্লক করা হয়েছে`);
    } catch {
      showToast('প্রোফাইল ব্লক করা সম্ভব হয়নি');
    } finally {
      setIsUpdatingBlock(false);
    }
  };

  // Handle Unblock Worker Profile
  const handleUnblockWorker = async () => {
    setIsUpdatingBlock(true);
    try {
      await unblockEmployeeProfile(employee.id);
      setIsBlocked(false);
      setBlockReason('');
      showToast(`✓ "${employee.name}" এর প্রোফাইল আনব্লক করা হয়েছে`);
    } catch {
      showToast('প্রোফাইল আনব্লক করা সম্ভব হয়নি');
    } finally {
      setIsUpdatingBlock(false);
    }
  };

  // Handle Regenerate / Change Worker Profile Link (invalidates old link)
  const handleRegenerateLink = async () => {
    setIsRegeneratingLink(true);
    try {
      const newToken = await regenerateWorkerPortalLink(employee.id);
      setPortalToken(newToken);
      setPortalLinkEnabled(true);
      showToast('✓ শ্রমিকের নতুন পোর্টাল লিংক তৈরি হয়েছে! পূর্বের পুরাতন লিংকটি সাথে সাথে বাতিল করা হয়েছে।');
    } catch {
      showToast('নতুন লিংক তৈরিতে সমস্যা হয়েছে');
    } finally {
      setIsRegeneratingLink(false);
    }
  };

  // Handle Toggle Portal Link Status (Enable / Disable)
  const handleToggleLinkAccess = async () => {
    const nextState = !portalLinkEnabled;
    setIsTogglingLink(true);
    try {
      await toggleWorkerPortalLink(employee.id, nextState);
      setPortalLinkEnabled(nextState);
      if (nextState) {
        showToast('✓ শ্রমিকের প্রোফাইল লিংক অ্যাক্সেস চালু করা হয়েছে');
      } else {
        showToast('⛔ শ্রমিকের প্রোফাইল লিংক সম্পূর্ণ বন্ধ ও নিষ্ক্রিয় করা হয়েছে');
      }
    } catch {
      showToast('লিংক স্ট্যাটাস পরিবর্তন করা সম্ভব হয়নি');
    } finally {
      setIsTogglingLink(false);
    }
  };

  // Individual dedicated worker login URL for this specific worker
  const workerLoginUrl = getWorkerLoginUrl({
    workerId: employee.workerId,
    portalToken: portalToken || employee.portalToken,
  });

  // Copy personal link
  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(workerLoginUrl);
      setCopiedLink(true);
      showToast(`✓ ${employee.name} (${employee.workerId}) এর আলাদা ব্যক্তিগত লগইন লিংক কপি হয়েছে!`);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showToast('লিংক কপি করা সম্ভব হয়নি');
    }
  };

  // Copy complete login message
  const fullCredentialsText = getWorkerCredentialsMessage(
    { ...employee, mobile, portalToken: portalToken || employee.portalToken },
    password
  );

  const handleCopyAll = () => {
    try {
      navigator.clipboard.writeText(fullCredentialsText);
      setCopiedAll(true);
      showToast('সম্পূর্ণ লগইন তথ্য ও লিংক কপি করা হয়েছে!');
      setTimeout(() => setCopiedAll(false), 2500);
    } catch {
      showToast('তথ্য কপি করা সম্ভব হয়নি');
    }
  };

  // Share via WhatsApp
  const handleShareWhatsApp = () => {
    const cleanNum = (mobile || employee.mobile || '').replace(/[^0-9]/g, '');
    const waUrl = cleanNum
      ? `https://wa.me/88${cleanNum}?text=${encodeURIComponent(fullCredentialsText)}`
      : `https://wa.me/?text=${encodeURIComponent(fullCredentialsText)}`;
    window.open(waUrl, '_blank');
  };

  // Share via SMS
  const handleShareSms = () => {
    const cleanNum = (mobile || employee.mobile || '').replace(/[^0-9]/g, '');
    const smsUrl = `sms:${cleanNum}?body=${encodeURIComponent(fullCredentialsText)}`;
    window.location.href = smsUrl;
  };

  // Save mobile & password to database
  const handleSaveCredentials = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password.trim()) {
      showToast('অনুগ্রহ করে একটি পাসওয়ার্ড দিন');
      return;
    }

    setIsSaving(true);
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
        mobile: mobile.trim(),
        address: employee.address,
        photoUrl: employee.photoUrl,
        signatureUrl: employee.signatureUrl,
        bankName: employee.bankName,
        accountName: employee.accountName,
        accountNumber: employee.accountNumber,
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
        statusChangedAt: employee.statusChangedAt,
        portalPassword: password.trim(),
        isBlocked: employee.isBlocked,
        blockReason: employee.blockReason,
        blockedAt: employee.blockedAt,
        portalToken: portalToken || employee.portalToken,
        portalLinkEnabled: portalLinkEnabled,
        portalLinkChangedAt: employee.portalLinkChangedAt,
      };

      await saveOrUpdateEmployee(payload, employee.id);
      showToast(`"${employee.name}" এর লগইন পাসওয়ার্ড ও মোবাইল সফলভাবে আপডেট হয়েছে!`);
    } catch (err) {
      console.error(err);
      showToast('তথ্য সংরক্ষণ করা সম্ভব হয়নি');
    } finally {
      setIsSaving(false);
    }
  };

  // Generate random 6-digit PIN
  const handleGenerateRandomPin = () => {
    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    setPassword(randomPin);
    showToast(`নতুন ৬ ডিজিটের পাসওয়ার্ড তৈরি করা হয়েছে: ${randomPin}`);
  };

  // Set default to last 4 digits of phone
  const handleSetLast4Phone = () => {
    const digits = (mobile || employee.mobile || '').replace(/[^0-9]/g, '');
    if (digits.length >= 4) {
      const last4 = digits.slice(-4);
      setPassword(last4);
      showToast(`পাসওয়ার্ড মোবাইলের শেষ ৪ ডিজিট (${last4}) সেট করা হয়েছে`);
    } else {
      setPassword('123456');
      showToast('মোবাইল নম্বর না থাকায় ডিফল্ট 123456 সেট করা হয়েছে');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-4">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-5 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>📱 শ্রমিক অ্যাপ লগইন লিংক ও পাসওয়ার্ড নিয়ন্ত্রণ</span>
              </h3>
              <p className="text-xs text-indigo-200 mt-0.5">
                অ্যাডমিন কন্ট্রোল: শ্রমিকের আলাদা অ্যাপ লগইন লিংক, পাসওয়ার্ড ও প্রোফাইল নিয়ন্ত্রণ
              </p>
            </div>
          </div>
        </div>

        {/* Worker Summary Banner */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-2xl bg-slate-200 border-2 border-white shadow-xs overflow-hidden shrink-0 flex items-center justify-center">
            {employee.photoUrl ? (
              <img
                src={employee.photoUrl}
                alt={employee.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <User className="w-7 h-7 text-slate-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-black text-slate-900 text-sm">{employee.name}</h4>
              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200">
                {employee.workerId}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>পদ: <b className="text-slate-700">{employee.designation}</b></span>
              <span>•</span>
              <span>সেকশন: <b className="text-slate-700">{employee.department || 'সুইং'}</b></span>
              <span>•</span>
              <span>বেতন: <b className="text-emerald-700">৳ {formatMoney(employee.salary)}</b></span>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-5 text-xs max-h-[75vh] overflow-y-auto">
          {/* SECTION 0: WORKER PROFILE BLOCK / UNBLOCK CONTROL */}
          <div className={`p-4 rounded-2xl border transition-all ${
            isBlocked
              ? 'bg-red-50/90 border-red-200 ring-1 ring-red-300'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 mb-3">
              <span className="font-black flex items-center gap-1.5 text-xs text-slate-900">
                <Ban className={`w-4 h-4 ${isBlocked ? 'text-red-600' : 'text-slate-500'}`} />
                <span>শ্রমিক প্রোফাইল অ্যাক্সেস ও ব্লক নিয়ন্ত্রণ</span>
              </span>
              <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
                isBlocked
                  ? 'bg-red-100 text-red-800 border-red-300'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}>
                {isBlocked ? '⛔ বর্তমানে ব্লক করা' : '✓ আনব্লক (সক্রিয়)'}
              </span>
            </div>

            {isBlocked ? (
              <div className="space-y-3">
                <div className="p-3 bg-red-100/60 rounded-xl border border-red-200 text-red-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                    <span>ব্লক করার কারণ (শ্রমিক লগইনে এটি দেখতে পাবে):</span>
                  </div>
                  <p className="text-xs font-semibold pl-5 text-red-900">
                    "{blockReason || employee.blockReason || 'প্রশাসনিক প্রয়োজনে অ্যাকাউন্ট সাময়িকভাবে বন্ধ রাখা হয়েছে।'}"
                  </p>
                  {employee.blockedAt && (
                    <p className="text-[10px] text-red-700 pl-5">
                      ব্লক করার সময়: {formatDateBn(new Date(employee.blockedAt).toISOString().slice(0, 10))}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleUnblockWorker}
                  disabled={isUpdatingBlock}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingBlock ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Unlock className="w-4 h-4" />
                  )}
                  <span>এই শ্রমিকের প্রোফাইল আনব্লক (Unblock) করুন</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    ব্লক করার সুনির্দিষ্ট কারণ লিখুন (শ্রমিক লগইন করতে গেলে এটি দেখতে পারবে):
                  </label>
                  <input
                    type="text"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="যেমন: শৃঙ্খলা ভঙ্গ, তদন্তাধীন, অনিয়মিত উপস্থিতি ইত্যাদি"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-red-400 outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    ব্লক করা থাকলে শ্রমিক তার প্রোফাইলে লগইন করতে পারবে না এবং কারণটি প্রদর্শিত হবে।
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleBlockWorker}
                  disabled={isUpdatingBlock}
                  className="py-2 px-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingBlock ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Ban className="w-3.5 h-3.5" />
                  )}
                  <span>শ্রমিক প্রোফাইল ব্লক করুন (Block Profile)</span>
                </button>
              </div>
            )}
          </div>

          {/* SECTION 1: CREDENTIALS EDITING (ADMIN CONTROLS) */}
          <form onSubmit={handleSaveCredentials} className="space-y-3.5 bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100">
            <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
              <span className="font-black text-indigo-950 flex items-center gap-1.5 text-xs">
                <Lock className="w-4 h-4 text-indigo-600" />
                <span>শ্রমিকের লগইন তথ্য সম্পাদনা (অ্যাডমিন কন্ট্রোল)</span>
              </span>
              <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-100/70 px-2 py-0.5 rounded-full">
                অ্যাডমিন কতৃক নিয়ন্ত্রিত
              </span>
            </div>

            {/* Mobile Number Input */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                নিবন্ধিত মোবাইল নম্বর (Login Identifier)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="017xxxxxxxx"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none pr-9 text-xs"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <span className="text-[10.5px] text-slate-500 mt-0.5 block">
                শ্রমিক শুধুমাত্র এই মোবাইল নম্বর এবং পাসওয়ার্ড দিয়ে লগইন করতে পারবে (শ্রমিক আইডি দিয়ে লগইন করা যাবে না)
              </span>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-800">
                  পোর্টাল লগইন পাসওয়ার্ড (Portal Password) *
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSetLast4Phone}
                    className="text-[10px] text-indigo-700 hover:text-indigo-900 underline font-semibold cursor-pointer"
                  >
                    মোবাইলের শেষ ৪ ডিজিট
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => setPassword('123456')}
                    className="text-[10px] text-indigo-700 hover:text-indigo-900 underline font-semibold cursor-pointer"
                  >
                    ১২৩৪৫৬
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={handleGenerateRandomPin}
                    className="text-[10px] text-indigo-700 hover:text-indigo-900 underline font-semibold cursor-pointer"
                  >
                    র‍্যান্ডম পিন
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="পাসওয়ার্ড লিখুন"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-black text-indigo-950 focus:ring-2 focus:ring-indigo-500 outline-none pr-9 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[10.5px] text-slate-500 mt-0.5 block">
                শ্রমিক এই পাসওয়ার্ড দিয়ে লগইন করে তার ইন/আউট টাইম ও বেতন দেখতে পারবে
              </span>
            </div>

            {/* Save Button */}
            <div className="pt-1 flex items-center justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-1.5 transition active:scale-95 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>পাসওয়ার্ড ও মোবাইল সেভ করুন</span>
              </button>
            </div>
          </form>

          {/* SECTION 2: GENERATED DEDICATED PROFILE LINK & ACCESS MANAGEMENT */}
          <div className="space-y-3.5 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
              <span className="font-black text-slate-900 flex items-center gap-1.5 text-xs">
                <LinkIcon className="w-4 h-4 text-blue-600" />
                <span>শ্রমিকের ব্যক্তিগত অ্যাকাউন্ট লিংক ও অ্যাক্সেস নিয়ন্ত্রণ</span>
              </span>
              
              {/* Status Badge */}
              {employee.status !== 'active' ? (
                <span className="text-[10px] text-rose-800 font-bold bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-300 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  <span>চাকরি না করায় অ্যাক্সেস নিষিদ্ধ ({employee.status === 'resigned' ? 'পদত্যাগকৃত' : employee.status === 'terminated' ? 'বরখাস্ত' : 'স্থগিত'})</span>
                </span>
              ) : !portalLinkEnabled ? (
                <span className="text-[10px] text-amber-900 font-bold bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                  <ShieldOff className="w-3 h-3 text-amber-600" />
                  <span>অ্যাডমিন কতৃক লিংক বন্ধ</span>
                </span>
              ) : (
                <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>লিংক সক্রিয় ও সুরক্ষিত</span>
                </span>
              )}
            </div>

            {/* Employment Status Alert */}
            {employee.status !== 'active' && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-xs">
                  <p className="font-bold text-rose-900">শ্রমিক বর্তমানে কর্মরত নন!</p>
                  <p className="text-[11px] text-rose-800">
                    এই কর্মী পদত্যাগ বা চাকরিচ্যুত হওয়ায় তার অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে লক করা হয়েছে। তিনি পুরাতন বা নতুন কোনো লিংকেই প্রবেশ করতে পারবেন না।
                  </p>
                </div>
              </div>
            )}

            {/* Link Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-slate-700">
                  {employee.name} এর আলাদা ব্যক্তিগত লগইন লিংক (Dedicated Personal URL):
                </label>
                <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  স্বতন্ত্র লিংক
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2">
                <span className="font-mono text-[11px] text-slate-800 truncate select-all flex-1">
                  {workerLoginUrl}
                </span>
                <a
                  href={workerLoginUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition cursor-pointer"
                  title="নতুন ট্যাবে এই শ্রমিকের ব্যক্তিগত লগইন পেজ খুলুন"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 shrink-0 transition active:scale-95 cursor-pointer ${
                    copiedLink
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs'
                  }`}
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'কপি হয়েছে' : 'লিংক কপি'}</span>
                </button>
              </div>
            </div>

            {/* Admin Link Regeneration & Invalidation Controls */}
            <div className="p-3 bg-slate-100/70 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                    <span>লিংক পরিবর্তন / পুরাতন লিংক বাতিল করুন</span>
                  </h5>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    কর্মী চাকরি ছেড়ে দিলে বা লিংক ফাঁস হলে নতুন লিংক তৈরি করুন; এতে পূর্ববর্তী পুরাতন লিংকটি স্থায়ীভাবে অকেজো হয়ে যাবে।
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleRegenerateLink}
                  disabled={isRegeneratingLink}
                  className="py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                  title="নতুন সিক্রেট লিংক তৈরি করুন (পুরাতন লিংক সাথে সাথে বাতিল হবে)"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isRegeneratingLink ? 'animate-spin' : ''}`} />
                  <span>নতুন সিক্রেট লিংক তৈরি করুন (Regenerate Link)</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleLinkAccess}
                  disabled={isTogglingLink}
                  className={`py-1.5 px-3 rounded-lg font-bold text-xs flex items-center gap-1.5 border transition active:scale-95 cursor-pointer disabled:opacity-50 ${
                    portalLinkEnabled
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                  }`}
                  title={portalLinkEnabled ? 'শ্রমিকের পোর্টাল লিংক বন্ধ করুন' : 'শ্রমিকের পোর্টাল লিংক চালু করুন'}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{portalLinkEnabled ? 'পোর্টাল লিংক বন্ধ রাখুন' : 'পোর্টাল লিংক চালু করুন'}</span>
                </button>
              </div>
            </div>

            {/* Fast Sharing Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {/* Copy Full Credentials Text */}
              <button
                type="button"
                onClick={handleCopyAll}
                className={`py-2 px-2.5 rounded-xl border font-bold text-[11px] flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer ${
                  copiedAll
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                }`}
                title="শ্রমিকের আইডি, পাসওয়ার্ড ও লিংকসহ সম্পূর্ণ মেসেজ কপি করুন"
              >
                {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
                <span>{copiedAll ? 'তথ্য কপি হয়েছে' : 'সব তথ্য কপি করুন'}</span>
              </button>

              {/* Share to WhatsApp */}
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
                title="শ্রমিককে হোয়াটসঅ্যাপে সরাসরি লিংক ও পাসওয়ার্ড পাঠান"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp এ পাঠান</span>
              </button>

              {/* Share via SMS */}
              <button
                type="button"
                onClick={handleShareSms}
                className="py-2 px-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
                title="মোবাইল এসএমএস এ পাঠান"
              >
                <Send className="w-3.5 h-3.5" />
                <span>SMS এ পাঠান</span>
              </button>
            </div>
          </div>

          {/* SECTION 3: WORKER PERMISSION & SECURITY INFO */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-amber-950">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-[11px]">শ্রমিকের অ্যাক্সেস ও নিরাপত্তা নির্দেশিকা:</p>
              <ul className="list-disc list-inside text-[10.5px] text-amber-900 space-y-0.5">
                <li>শ্রমিক এই লিংকে গিয়ে মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে তার প্রোফাইলে প্রবেশ করতে পারবে।</li>
                <li>শ্রমিক তার প্রতিদিনের <b>ইনটাইম, আউটটাইম, মোট ওটি (OT), অনুপস্থিত দিন ও বেতন</b> দেখতে পারবে।</li>
                <li><b>শুধুমাত্র দেখার অনুমতি (Read-Only):</b> শ্রমিক কোনো তথ্য এডিট, আপডেট বা ডিলিট করতে পারবে না।</li>
                <li>কারখানা অ্যাডমিন যেকোনো সময় এই প্যানেল থেকে পাসওয়ার্ড ও মোবাইল পরিবর্তন করতে পারবেন।</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-3.5 flex items-center justify-between">
          <a
            href={workerLoginUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-800 font-bold text-xs inline-flex items-center gap-1 hover:underline"
          >
            <span>ব্রাউজারে শ্রমিক ভিউ টেস্ট করুন</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition active:scale-95 cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
